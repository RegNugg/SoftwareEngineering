class ShopAnalytics {
  final String shopId;
  final String shopName;
  final AnalyticsPeriod? today;
  final AnalyticsPeriod allTime;

  ShopAnalytics({
    required this.shopId,
    required this.shopName,
    this.today,
    required this.allTime,
  });

  factory ShopAnalytics.fromJson(Map<String, dynamic> json) {
    return ShopAnalytics(
      shopId: json['shopId'] as String? ?? json['shop_id'] as String? ?? '',
      shopName: json['shopName'] as String? ?? json['shop_name'] as String? ?? '',
      today: json['today'] != null ? AnalyticsPeriod.fromJson(json['today'] as Map<String, dynamic>) : null,
      allTime: AnalyticsPeriod.fromJson(json['allTime'] as Map<String, dynamic>),
    );
  }
}

class AnalyticsPeriod {
  final int totalCustomers;
  final int customersServed;
  final int noShows;
  final int skipped;
  final int cancelled;
  final int? avgWaitSeconds;
  final int? peakHour;
  final double serviceRate;

  AnalyticsPeriod({
    required this.totalCustomers,
    required this.customersServed,
    required this.noShows,
    required this.skipped,
    required this.cancelled,
    this.avgWaitSeconds,
    this.peakHour,
    required this.serviceRate,
  });

  factory AnalyticsPeriod.fromJson(Map<String, dynamic> json) {
    return AnalyticsPeriod(
      totalCustomers: (json['totalCustomers'] as num?)?.toInt() ?? 0,
      customersServed: (json['customersServed'] as num?)?.toInt() ?? 0,
      noShows: (json['noShows'] as num?)?.toInt() ?? 0,
      skipped: (json['skipped'] as num?)?.toInt() ?? 0,
      cancelled: (json['cancelled'] as num?)?.toInt() ?? 0,
      avgWaitSeconds: (json['avgWaitSeconds'] as num?)?.toInt(),
      peakHour: (json['peakHour'] as num?)?.toInt(),
      serviceRate: (json['serviceRate'] as num?)?.toDouble() ?? 0.0,
    );
  }

  int get avgWaitMinutes => avgWaitSeconds != null ? avgWaitSeconds! ~/ 60 : 0;
  String get peakHourDisplay => peakHour != null ? _formatHour(peakHour!) : 'N/A';

  String _formatHour(int hour) {
    if (hour == 0) return '12:00 AM';
    if (hour < 12) return '$hour:00 AM';
    if (hour == 12) return '12:00 PM';
    return '${hour - 12}:00 PM';
  }
}