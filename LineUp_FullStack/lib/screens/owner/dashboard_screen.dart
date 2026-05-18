import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/shops_provider.dart';
import '../../providers/queue_provider.dart';
import '../../providers/analytics_provider.dart';
import '../../models/shop_analytics.dart';
import '../../widgets/queue_list_tile.dart';

class DashboardScreen extends StatefulWidget {
  final String shopId;

  const DashboardScreen({super.key, required this.shopId});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool _analyticsExpanded = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ShopsProvider>().selectShop(widget.shopId);
      context.read<QueueProvider>().fetchQueue(widget.shopId);
      context.read<AnalyticsProvider>().fetchAnalytics(widget.shopId);
    });
  }

  void _showError(String? error) {
    if (error != null && error.isNotEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error), backgroundColor: AppTheme.red),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final shopsProvider = context.watch<ShopsProvider>();
    final queueProvider = context.watch<QueueProvider>();
    final analyticsProvider = context.watch<AnalyticsProvider>();
    final shop = shopsProvider.selectedShop;
    final queue = queueProvider.queueForShop(widget.shopId);
    final activeQueue = queue.where((e) => e.status == 'waiting' || e.status == 'called').toList();
    final qLen = activeQueue.length;

    if (shop == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            const Text('🛒', style: TextStyle(fontSize: 22)),
            const SizedBox(width: 8),
            RichText(
              text: const TextSpan(
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
                children: [
                  TextSpan(text: 'Line '),
                  TextSpan(text: 'Up', style: TextStyle(color: AppTheme.orange)),
                ],
              ),
            ),
          ],
        ),
        actions: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: AppTheme.orange.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Text('Shop Owner', style: TextStyle(color: AppTheme.orange, fontWeight: FontWeight.w700, fontSize: 12)),
          ),
          const SizedBox(width: 8),
          IconButton(
            icon: const Icon(Icons.swap_horiz, color: Colors.white),
            onPressed: () => context.go('/'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await context.read<QueueProvider>().fetchQueue(widget.shopId);
          await context.read<ShopsProvider>().selectShop(widget.shopId);
          await context.read<AnalyticsProvider>().fetchAnalytics(widget.shopId);
        },
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Card(
              color: AppTheme.blue,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(shop.name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Colors.white)),
                              const SizedBox(height: 4),
                              Text(shop.category, style: const TextStyle(fontSize: 14, color: Colors.white70)),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                          decoration: BoxDecoration(
                            color: shop.isOpen ? AppTheme.green.withValues(alpha: 0.2) : AppTheme.red.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            shop.isOpen ? '● Open' : '● Closed',
                            style: TextStyle(color: shop.isOpen ? AppTheme.green : AppTheme.red, fontWeight: FontWeight.w700, fontSize: 12),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        _StatBox(label: 'In queue', value: '$qLen'),
                        const SizedBox(width: 12),
                        _StatBox(label: 'Total wait', value: '${qLen * shop.avgServiceMinutes}m'),
                        const SizedBox(width: 12),
                        _StatBox(label: 'Avg / customer', value: '${shop.avgServiceMinutes}m'),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () async {
                  final shopsProv = context.read<ShopsProvider>();
                  final queueProv = context.read<QueueProvider>();
                  final analyticsProv = context.read<AnalyticsProvider>();
                  if (shop.isOpen) {
                    await queueProv.closeQueue(widget.shopId);
                    if (queueProv.error != null) _showError(queueProv.error);
                  } else {
                    await shopsProv.toggleShopStatus(widget.shopId, !shop.isOpen);
                    if (shopsProv.error != null) _showError(shopsProv.error);
                  }
                  await shopsProv.selectShop(widget.shopId);
                  await queueProv.fetchQueue(widget.shopId);
                  await analyticsProv.fetchAnalytics(widget.shopId);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: shop.isOpen ? AppTheme.red : AppTheme.orange,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  padding: const EdgeInsets.symmetric(vertical: 13),
                ),
                child: Text(
                  shop.isOpen ? '🔒 Close Queue' : '🟢 Open Queue',
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                ),
              ),
            ),
            const SizedBox(height: 20),
            const Text('Manage Queue', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppTheme.gray900)),
            const SizedBox(height: 12),
            if (activeQueue.isEmpty)
              Card(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 16),
                  child: Column(children: [
                    const Text('✅', style: TextStyle(fontSize: 40)),
                    const SizedBox(height: 8),
                    const Text('Queue is empty', style: TextStyle(fontWeight: FontWeight.w700, color: AppTheme.gray600)),
                    const SizedBox(height: 4),
                    const Text('No customers waiting right now.', style: TextStyle(fontSize: 13, color: AppTheme.gray400)),
                  ]),
                ),
              )
            else ...[
              if (activeQueue.isNotEmpty && activeQueue.first.status == 'called') ...[
                Container(
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(colors: [AppTheme.orange, AppTheme.orangeLight]),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppTheme.orange, width: 2),
                  ),
                  padding: const EdgeInsets.all(16),
                  margin: const EdgeInsets.only(bottom: 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('NOW SERVING', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.orange)),
                      const SizedBox(height: 4),
                      Text(activeQueue.first.userName ?? activeQueue.first.userId, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: AppTheme.gray900)),
                      const SizedBox(height: 12),
                      Row(children: [
                        Expanded(
                          child: ElevatedButton(
                            onPressed: () async {
                              await context.read<QueueProvider>().attend(widget.shopId);
                              await context.read<AnalyticsProvider>().fetchAnalytics(widget.shopId);
                            },
                            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.orange, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                            child: const Text('✓ Done — Next', style: TextStyle(fontWeight: FontWeight.w700)),
                          ),
                        ),
                        const SizedBox(width: 8),
                        OutlinedButton(
                          onPressed: () async {
                            await context.read<QueueProvider>().skip(widget.shopId, 'owner_skip');
                            await context.read<AnalyticsProvider>().fetchAnalytics(widget.shopId);
                          },
                          style: OutlinedButton.styleFrom(foregroundColor: AppTheme.red, side: const BorderSide(color: AppTheme.red), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                          child: const Text('Skip'),
                        ),
                      ]),
                    ],
                  ),
                ),
              ] else if (activeQueue.isNotEmpty) ...[
                Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: ElevatedButton(
                    onPressed: () async {
                      await context.read<QueueProvider>().callNext(widget.shopId);
                      await context.read<AnalyticsProvider>().fetchAnalytics(widget.shopId);
                      final q = context.read<QueueProvider>();
                      if (q.error != null) _showError(q.error);
                    },
                    style: ElevatedButton.styleFrom(backgroundColor: AppTheme.orange, minimumSize: const Size.fromHeight(48), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                    child: const Text('📞 Call Next Customer', style: TextStyle(fontWeight: FontWeight.w700)),
                  ),
                ),
              ],
              ...activeQueue.skip(1).map((entry) => QueueListTile(
                entry: entry,
                isMe: false,
                isFirst: false,
                avgMinutes: shop.avgServiceMinutes,
                isLast: entry == activeQueue.last,
                onSkip: () async {
                  await context.read<QueueProvider>().skip(widget.shopId, 'owner_skip');
                  await context.read<AnalyticsProvider>().fetchAnalytics(widget.shopId);
                  final q = context.read<QueueProvider>();
                  if (q.error != null) _showError(q.error);
                },
              )),
            ],
            const SizedBox(height: 24),
            _buildAnalyticsSection(analyticsProvider),
          ],
        ),
      ),
    );
  }

  Widget _buildAnalyticsSection(AnalyticsProvider analyticsProvider) {
    final analytics = analyticsProvider.analytics;
    final isLoading = analyticsProvider.isLoading;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GestureDetector(
          onTap: () => setState(() => _analyticsExpanded = !_analyticsExpanded),
          child: Row(
            children: [
              const Text('📊 Analytics', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppTheme.gray900)),
              const Spacer(),
              Icon(_analyticsExpanded ? Icons.expand_less : Icons.expand_more, color: AppTheme.gray600),
            ],
          ),
        ),
        if (_analyticsExpanded) ...[
          const SizedBox(height: 12),
          if (isLoading)
            const Center(child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator()))
          else if (analytics == null)
            const Center(child: Padding(padding: EdgeInsets.all(32), child: Text('No analytics data available', style: TextStyle(color: AppTheme.gray400))))
          else ...[
            if (analytics.today != null) ...[
              _buildPeriodSection('Today', analytics.today!, AppTheme.blue),
              const SizedBox(height: 16),
            ] else
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      const Text('📊', style: TextStyle(fontSize: 28)),
                      const SizedBox(height: 8),
                      const Text('Today\'s analytics will be available after closing the queue.', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.w600, color: AppTheme.gray600)),
                    ],
                  ),
                ),
              ),
            _buildPeriodSection('All Time', analytics.allTime, AppTheme.gray600),
          ],
        ],
      ],
    );
  }

  Widget _buildPeriodSection(String title, AnalyticsPeriod period, Color accentColor) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: accentColor)),
            const SizedBox(height: 12),
            Row(
              children: [
                _MiniStatCard(label: 'Total', value: '${period.totalCustomers}', icon: '🧑‍🤝‍🧑', color: accentColor),
                const SizedBox(width: 8),
                _MiniStatCard(label: 'Served', value: '${period.customersServed}', icon: '✅', color: AppTheme.green),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                _MiniStatCard(
                  label: 'Avg wait',
                  value: period.avgWaitSeconds != null ? '${period.avgWaitMinutes}m' : '—',
                  icon: '⏱',
                  color: AppTheme.orange,
                ),
                const SizedBox(width: 8),
                _MiniStatCard(
                  label: 'Service rate',
                  value: '${(period.serviceRate * 100).toInt()}%',
                  icon: '📊',
                  color: period.serviceRate >= 0.8 ? AppTheme.green : AppTheme.orange,
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                _MiniStatCard(
                  label: 'Peak hour',
                  value: period.peakHourDisplay,
                  icon: '🕐',
                  color: AppTheme.blue,
                ),
                const SizedBox(width: 8),
                _MiniStatCard(
                  label: 'No shows',
                  value: '${period.noShows}',
                  icon: '⚠',
                  color: period.noShows > 0 ? AppTheme.red : AppTheme.gray400,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _StatBox extends StatelessWidget {
  final String label;
  final String value;

  const _StatBox({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Colors.white)),
            const SizedBox(height: 2),
            Text(label, style: const TextStyle(fontSize: 11, color: Colors.white70)),
          ],
        ),
      ),
    );
  }
}

class _MiniStatCard extends StatelessWidget {
  final String label;
  final String value;
  final String icon;
  final Color color;

  const _MiniStatCard({required this.label, required this.value, required this.icon, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.15)),
        ),
        child: Column(
          children: [
            Text(icon, style: const TextStyle(fontSize: 18)),
            const SizedBox(height: 4),
            Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: color)),
            const SizedBox(height: 2),
            Text(label, style: TextStyle(fontSize: 11, color: AppTheme.gray400, fontWeight: FontWeight.w500)),
          ],
        ),
      ),
    );
  }
}