<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$apiKey = 'hvC7xIgHa61adbff31f3a042pjciRdbx';
$cacheFile = __DIR__ . '/cache_ongkir.json';
$counterFile = __DIR__ . '/daily_limit.json';
$maxDailyRequests = 85; // حد أمان لحماية رصيد الـ 100 طلب اليومي
$cacheDuration = 259200; // 3 أيام بالثواني (72 ساعة)

$origin = isset($_GET['origin']) ? preg_replace('/[^0-9]/', '', $_GET['origin']) : '';
$destination = isset($_GET['destination']) ? preg_replace('/[^0-9]/', '', $_GET['destination']) : '';
$weight = isset($_GET['weight']) ? (int)$_GET['weight'] : 1000;

if (!$origin || !$destination || $weight <= 0) {
    echo json_encode(['status' => 'error', 'message' => 'Parameter tidak lengkap']);
    exit;
}

// تقريب الوزن لأقرب كيلوغرام كما هو معمول به في إندونيسيا لتوحيد التخزين المؤقت
$weightKg = max(1, ceil($weight / 1000)) * 1000;
$cacheKey = "{$origin}_{$destination}_{$weightKg}";

// 1. قراءة ذاكرة التخزين المؤقت (Cache)
$cache = file_exists($cacheFile) ? json_decode(file_get_contents($cacheFile), true) : [];
if (!is_array($cache)) $cache = [];

if (isset($cache[$cacheKey]) && (time() - $cache[$cacheKey]['time']) < $cacheDuration) {
    echo json_encode([
        'status' => 'success',
        'source' => 'cache',
        'data' => $cache[$cacheKey]['data']
    ]);
    exit;
}

// 2. التحقق من عداد الاستهلاك اليومي لحماية الرصيد
$today = date('Y-m-d');
$counter = file_exists($counterFile) ? json_decode(file_get_contents($counterFile), true) : ['date' => $today, 'count' => 0];
if ($counter['date'] !== $today) {
    $counter = ['date' => $today, 'count' => 0];
}

if ($counter['count'] >= $maxDailyRequests) {
    echo json_encode(['status' => 'limit_reached', 'message' => 'Batas harian API tercapai']);
    exit;
}

// 3. جلب الأسعار الحقيقية من RajaOngkir (JNE, POS, TIKI)
$couriers = ['jne', 'pos', 'tiki'];
$results = [];

foreach ($couriers as $courier) {
    if ($counter['count'] >= $maxDailyRequests) break;

    $curl = curl_init();
    curl_setopt_array($curl, [
        CURLOPT_URL => "https://api.rajaongkir.com/starter/cost",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_ENCODING => "",
        CURLOPT_MAXREDIRS => 10,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        CURLOPT_CUSTOMREQUEST => "POST",
        CURLOPT_POSTFIELDS => "origin={$origin}&destination={$destination}&weight={$weightKg}&courier={$courier}",
        CURLOPT_HTTPHEADER => [
            "content-type: application/x-www-form-urlencoded",
            "key: {$apiKey}"
        ],
    ]);

    $response = curl_exec($curl);
    $err = curl_error($curl);
    curl_close($curl);

    $counter['count']++;

    if (!$err && $response) {
        $decoded = json_decode($response, true);
        if (isset($decoded['rajaongkir']['status']['code']) && $decoded['rajaongkir']['status']['code'] == 200) {
            $results[] = $decoded['rajaongkir']['results'][0];
        }
    }
}

// تحديث عداد الاستهلاك اليومي
file_put_contents($counterFile, json_encode($counter));

if (!empty($results)) {
    $cache[$cacheKey] = [
        'time' => time(),
        'data' => $results
    ];
    file_put_contents($cacheFile, json_encode($cache));

    echo json_encode([
        'status' => 'success',
        'source' => 'api',
        'data' => $results
    ]);
} else {
    echo json_encode(['status' => 'fallback', 'message' => 'Gagal mengambil data API']);
}