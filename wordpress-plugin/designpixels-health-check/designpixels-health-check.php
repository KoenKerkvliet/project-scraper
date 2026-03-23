<?php
/**
 * Plugin Name: Design Pixels Health Check
 * Description: Monitort Bricks Builder code-elementen en rapporteert naar Supabase. Beheer via Instellingen → DP Health Check.
 * Version: 3.0.0
 * Author: Design Pixels
 * License: GPL v2 or later
 */

if (!defined('ABSPATH')) {
    exit;
}

// ─── Admin Menu ───────────────────────────────────────────────

add_action('admin_menu', function () {
    add_options_page(
        'DP Health Check',
        'DP Health Check',
        'manage_options',
        'dp-health-check',
        'dp_health_check_admin_page'
    );
});

add_action('admin_init', function () {
    register_setting('dp_health_check', 'dp_health_checks', [
        'sanitize_callback' => 'dp_health_check_sanitize',
        'default'           => [],
    ]);
    register_setting('dp_health_check', 'dp_health_supabase', [
        'sanitize_callback' => 'dp_health_supabase_sanitize',
        'default'           => [],
    ]);
});

function dp_health_check_sanitize($input) {
    if (!is_array($input)) {
        return [];
    }

    $clean = [];
    foreach ($input as $item) {
        $path       = sanitize_text_field($item['path'] ?? '');
        $element_id = sanitize_text_field($item['element_id'] ?? '');
        $check_text = sanitize_text_field($item['check_text'] ?? '');

        if ($path === '') {
            continue;
        }

        // Minimaal een element_id of check_text nodig
        if ($element_id === '' && $check_text === '') {
            continue;
        }

        if ($path[0] !== '/') {
            $path = '/' . $path;
        }

        if ($element_id !== '' && !preg_match('/^[a-zA-Z0-9_-]+$/', $element_id)) {
            continue;
        }

        $clean[] = [
            'path'       => $path,
            'element_id' => $element_id,
            'check_text' => $check_text,
        ];
    }

    return $clean;
}

function dp_health_supabase_sanitize($input) {
    return [
        'url'         => sanitize_url($input['url'] ?? ''),
        'service_key' => sanitize_text_field($input['service_key'] ?? ''),
    ];
}

// ─── Run checks and report to Supabase ───────────────────────

function dp_run_health_checks() {
    $checks = get_option('dp_health_checks', []);
    if (empty($checks)) {
        return [];
    }

    $results = [];

    // Group checks by path so we only fetch each page once
    $pages = [];
    foreach ($checks as $check) {
        $pages[$check['path']][] = $check;
    }

    foreach ($pages as $path => $page_checks) {
        $start = microtime(true);

        $url = home_url($path);
        $response = wp_remote_get($url, [
            'timeout'   => 10,
            'sslverify' => false,
        ]);

        $time_ms = round((microtime(true) - $start) * 1000);

        if (is_wp_error($response)) {
            $results[$path] = [
                'checks'          => array_map(function($c) { return $c['element_id'] ?: $c['check_text']; }, $page_checks),
                'found'           => false,
                'response_time_ms' => $time_ms,
                'error'           => $response->get_error_message(),
            ];
            continue;
        }

        $html = wp_remote_retrieve_body($response);

        // Check all elements/texts for this page
        $all_found = true;
        $failed_checks = [];

        foreach ($page_checks as $check) {
            $element_id = $check['element_id'] ?? '';
            $check_text = $check['check_text'] ?? '';
            $found = true;

            // Check element ID if specified
            if ($element_id !== '') {
                if (stripos($html, 'id="' . $element_id . '"') === false) {
                    $found = false;
                }
            }

            // Check text content if specified
            if ($check_text !== '') {
                if (stripos($html, $check_text) === false) {
                    $found = false;
                }
            }

            if (!$found) {
                $all_found = false;
                $label = $element_id ?: $check_text;
                $failed_checks[] = $label;
            }
        }

        $result_entry = [
            'found'           => $all_found,
            'response_time_ms' => $time_ms,
        ];

        if (!$all_found) {
            $result_entry['failed'] = $failed_checks;
        }

        $results[$path] = $result_entry;
    }

    return $results;
}

function dp_report_to_supabase($results) {
    $supabase = get_option('dp_health_supabase', []);
    $url = $supabase['url'] ?? '';
    $key = $supabase['service_key'] ?? '';

    if (empty($url) || empty($key)) {
        return false;
    }

    $api_url = rtrim($url, '/') . '/functions/v1/check-sites';

    $response = wp_remote_post($api_url, [
        'timeout' => 15,
        'headers' => [
            'Content-Type'  => 'application/json',
            'Authorization' => 'Bearer ' . $key,
        ],
        'body' => wp_json_encode([
            'source'  => 'wordpress-plugin',
            'site_url' => home_url(),
            'results' => $results,
        ]),
    ]);

    if (is_wp_error($response)) {
        return false;
    }

    return wp_remote_retrieve_response_code($response) >= 200
        && wp_remote_retrieve_response_code($response) < 300;
}

// ─── WordPress Cron ──────────────────────────────────────────

add_filter('cron_schedules', function ($schedules) {
    $schedules['every_30_minutes'] = [
        'interval' => 1800,
        'display'  => 'Elke 30 minuten',
    ];
    return $schedules;
});

register_activation_hook(__FILE__, function () {
    if (!wp_next_scheduled('dp_health_check_cron')) {
        wp_schedule_event(time(), 'every_30_minutes', 'dp_health_check_cron');
    }
});

register_deactivation_hook(__FILE__, function () {
    wp_clear_scheduled_hook('dp_health_check_cron');
});

add_action('dp_health_check_cron', function () {
    $results = dp_run_health_checks();
    if (!empty($results)) {
        dp_report_to_supabase($results);
    }
});

// ─── REST API Endpoint (still available for local testing) ───

add_action('rest_api_init', function () {
    register_rest_route('designpixels/v1', '/health', [
        'methods'             => 'GET',
        'callback'            => function () {
            $results = dp_run_health_checks();
            return new WP_REST_Response([
                'results'    => $results,
                'checked_at' => gmdate('c'),
            ]);
        },
        'permission_callback' => '__return_true',
    ]);
});

// ─── Admin Page ──────────────────────────────────────────────

function dp_health_check_admin_page() {
    $checks   = get_option('dp_health_checks', []);
    $supabase = get_option('dp_health_supabase', []);

    if (isset($_GET['settings-updated']) && $_GET['settings-updated']) {
        echo '<div class="notice notice-success is-dismissible"><p>Instellingen opgeslagen.</p></div>';
    }
    ?>
    <div class="wrap">
        <h1>Design Pixels Health Check</h1>

        <form method="post" action="options.php">
            <?php settings_fields('dp_health_check'); ?>

            <h2>Elementen om te monitoren</h2>
            <p class="description">Vul per check een <strong>Element ID</strong> en/of <strong>Check tekst</strong> in. Element ID controleert of het element bestaat. Check tekst controleert of specifieke code-output (bijv. CSS) in de pagina staat.</p>
            <table class="widefat fixed" id="dp-checks-table">
                <thead>
                    <tr>
                        <th style="width: 25%;">Pagina pad</th>
                        <th style="width: 25%;">Element ID</th>
                        <th style="width: 35%;">Check tekst</th>
                        <th style="width: 15%;"></th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($checks)) : ?>
                        <tr class="dp-check-row">
                            <td><input type="text" name="dp_health_checks[0][path]" value="" placeholder="/contact/" class="widefat" /></td>
                            <td><input type="text" name="dp_health_checks[0][element_id]" value="" placeholder="brxe-ofhwmq" class="widefat" /></td>
                            <td><input type="text" name="dp_health_checks[0][check_text]" value="" placeholder="horizontal-scroll-rtl" class="widefat" /></td>
                            <td><button type="button" class="button dp-remove-row">Verwijderen</button></td>
                        </tr>
                    <?php else : ?>
                        <?php foreach ($checks as $i => $check) : ?>
                            <tr class="dp-check-row">
                                <td><input type="text" name="dp_health_checks[<?php echo $i; ?>][path]" value="<?php echo esc_attr($check['path']); ?>" class="widefat" /></td>
                                <td><input type="text" name="dp_health_checks[<?php echo $i; ?>][element_id]" value="<?php echo esc_attr($check['element_id'] ?? ''); ?>" class="widefat" /></td>
                                <td><input type="text" name="dp_health_checks[<?php echo $i; ?>][check_text]" value="<?php echo esc_attr($check['check_text'] ?? ''); ?>" class="widefat" /></td>
                                <td><button type="button" class="button dp-remove-row">Verwijderen</button></td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
            <p style="margin-top: 10px;">
                <button type="button" class="button button-secondary" id="dp-add-row">+ Check toevoegen</button>
            </p>

            <h2>Supabase koppeling</h2>
            <p class="description">De plugin rapporteert automatisch elke 30 minuten naar Supabase.</p>
            <table class="form-table">
                <tr>
                    <th>Supabase URL</th>
                    <td><input type="url" name="dp_health_supabase[url]" value="<?php echo esc_attr($supabase['url'] ?? ''); ?>" class="regular-text" placeholder="https://xxxxx.supabase.co" /></td>
                </tr>
                <tr>
                    <th>Supabase Anon Key</th>
                    <td><input type="password" name="dp_health_supabase[service_key]" value="<?php echo esc_attr($supabase['service_key'] ?? ''); ?>" class="regular-text" placeholder="eyJhbG..." /></td>
                </tr>
            </table>

            <?php submit_button('Opslaan'); ?>
        </form>

        <hr />
        <h2>Test</h2>
        <p>
            <button type="button" class="button button-secondary" id="dp-test-btn">Health check uitvoeren</button>
            <button type="button" class="button button-secondary" id="dp-report-btn" style="margin-left: 5px;">Rapporteer naar Supabase</button>
        </p>
        <pre id="dp-test-result" style="background: #f0f0f0; padding: 15px; display: none; max-width: 600px;"></pre>
    </div>

    <script>
    (function() {
        var table = document.getElementById('dp-checks-table').querySelector('tbody');
        var idx = table.querySelectorAll('.dp-check-row').length;

        document.getElementById('dp-add-row').addEventListener('click', function() {
            var row = document.createElement('tr');
            row.className = 'dp-check-row';
            row.innerHTML =
                '<td><input type="text" name="dp_health_checks[' + idx + '][path]" value="" placeholder="/pagina-pad/" class="widefat" /></td>' +
                '<td><input type="text" name="dp_health_checks[' + idx + '][element_id]" value="" placeholder="brxe-xxxxx" class="widefat" /></td>' +
                '<td><input type="text" name="dp_health_checks[' + idx + '][check_text]" value="" placeholder="horizontal-scroll-rtl" class="widefat" /></td>' +
                '<td><button type="button" class="button dp-remove-row">Verwijderen</button></td>';
            table.appendChild(row);
            idx++;
        });

        table.addEventListener('click', function(e) {
            if (e.target.classList.contains('dp-remove-row')) {
                e.target.closest('tr').remove();
            }
        });

        document.getElementById('dp-test-btn').addEventListener('click', function() {
            var result = document.getElementById('dp-test-result');
            result.style.display = 'block';
            result.textContent = 'Laden...';

            fetch('<?php echo esc_url(rest_url('designpixels/v1/health')); ?>')
                .then(function(r) { return r.json(); })
                .then(function(data) { result.textContent = JSON.stringify(data, null, 2); })
                .catch(function(err) { result.textContent = 'Fout: ' + err.message; });
        });

        document.getElementById('dp-report-btn').addEventListener('click', function() {
            var result = document.getElementById('dp-test-result');
            result.style.display = 'block';
            result.textContent = 'Rapporteren naar Supabase...';

            fetch('<?php echo esc_url(admin_url('admin-ajax.php')); ?>?action=dp_report_now')
                .then(function(r) { return r.json(); })
                .then(function(data) { result.textContent = JSON.stringify(data, null, 2); })
                .catch(function(err) { result.textContent = 'Fout: ' + err.message; });
        });
    })();
    </script>
    <?php
}

// ─── AJAX endpoint for manual report ─────────────────────────

add_action('wp_ajax_dp_report_now', function () {
    if (!current_user_can('manage_options')) {
        wp_send_json_error('Geen toegang', 403);
    }

    $results = dp_run_health_checks();
    $reported = dp_report_to_supabase($results);

    wp_send_json_success([
        'results'  => $results,
        'reported' => $reported,
    ]);
});
