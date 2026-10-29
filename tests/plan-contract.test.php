<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/server/DriveSyncService.php';
$fixture = json_decode(file_get_contents(__DIR__ . '/fixtures/plan-compatibility.json'), true, 64, JSON_THROW_ON_ERROR);
foreach ($fixture['syncCases'] as $case) {
    if (DriveSyncService::validPlan($case['plan']) !== $case['valid']) {
        throw new RuntimeException('Shared sync contract failed: ' . $case['name']);
    }
}
echo count($fixture['syncCases']) . " shared JavaScript/PHP plan-contract cases passed.\n";
