import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:skillgame_flutter/providers/tournament_provider.dart';
import 'package:skillgame_flutter/providers/auth_provider.dart';
import 'package:skillgame_flutter/utils/theme.dart';
import 'package:skillgame_flutter/widgets/custom_button.dart';

class TournamentsScreen extends StatefulWidget {
  const TournamentsScreen({super.key});

  @override
  State<TournamentsScreen> createState() => _TournamentsScreenState();
}

class _TournamentsScreenState extends State<TournamentsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      final tournamentProvider =
          Provider.of<TournamentProvider>(context, listen: false);
      final authProvider = Provider.of<AuthProvider>(context, listen: false);

      tournamentProvider.loadActiveTournaments();
      if (authProvider.isAuthenticated) {
        tournamentProvider.loadPlayerTournaments(authProvider.token!);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            _buildTabBar(),
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [
                  _buildActiveTab(),
                  _buildMyTournamentsTab(),
                  _buildHistoryTab(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppTheme.surfaceColor, AppTheme.backgroundColor],
        ),
      ),
      padding: const EdgeInsets.all(20),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            'Tournaments',
            style: Theme.of(context).textTheme.displaySmall?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textPrimary,
                ),
          ),
          Container(
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: IconButton(
              onPressed: () {
                // Show calendar or schedule
              },
              icon:
                  const Icon(Icons.calendar_today, color: AppTheme.textPrimary),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTabBar() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      decoration: BoxDecoration(
        color: AppTheme.surfaceColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: TabBar(
        controller: _tabController,
        indicator: BoxDecoration(
          color: AppTheme.primaryColor,
          borderRadius: BorderRadius.circular(12),
        ),
        labelColor: Colors.white,
        unselectedLabelColor: AppTheme.textSecondary,
        labelStyle: const TextStyle(fontWeight: FontWeight.w600),
        tabs: const [
          Tab(text: 'Active'),
          Tab(text: 'My Tournaments'),
          Tab(text: 'History'),
        ],
      ),
    );
  }

  Widget _buildActiveTab() {
    return Consumer<TournamentProvider>(
      builder: (context, tournamentProvider, child) {
        if (tournamentProvider.isLoading) {
          return const Center(child: CircularProgressIndicator());
        }

        final tournaments = tournamentProvider.activeTournaments;

        if (tournaments.isEmpty) {
          return _buildEmptyState(
              'No active tournaments', 'Check back later for new tournaments');
        }

        return ListView.separated(
          padding: const EdgeInsets.all(20),
          itemCount: tournaments.length,
          separatorBuilder: (context, index) => const SizedBox(height: 16),
          itemBuilder: (context, index) {
            final tournament = tournaments[index];
            return _buildTournamentCard(tournament);
          },
        );
      },
    );
  }

  Widget _buildMyTournamentsTab() {
    return Consumer<TournamentProvider>(
      builder: (context, tournamentProvider, child) {
        if (tournamentProvider.isLoading) {
          return const Center(child: CircularProgressIndicator());
        }

        final tournaments = tournamentProvider.playerTournaments;

        if (tournaments.isEmpty) {
          return _buildEmptyState(
              'No tournaments joined', 'Join a tournament to see it here');
        }

        return ListView.separated(
          padding: const EdgeInsets.all(20),
          itemCount: tournaments.length,
          separatorBuilder: (context, index) => const SizedBox(height: 16),
          itemBuilder: (context, index) {
            final tournament = tournaments[index];
            return _buildTournamentCard(tournament);
          },
        );
      },
    );
  }

  Widget _buildHistoryTab() {
    return _buildEmptyState(
        'Tournament History', 'Your completed tournaments will appear here');
  }

  Widget _buildTournamentCard(tournament) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.surfaceColor,
        borderRadius: BorderRadius.circular(16),
        border: tournament.status == 'ACTIVE'
            ? Border.all(color: AppTheme.primaryColor, width: 1)
            : null,
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  tournament.name,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: AppTheme.textPrimary,
                      ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: _getStatusColor(tournament.status),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  tournament.status,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            tournament.gameType.toUpperCase(),
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppTheme.textSecondary,
                ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _buildInfoItem(Icons.attach_money,
                  '\$${tournament.entryFee.toStringAsFixed(2)}'),
              const SizedBox(width: 16),
              _buildInfoItem(Icons.emoji_events,
                  '\$${tournament.prizePool.toStringAsFixed(2)}'),
              const SizedBox(width: 16),
              _buildInfoItem(Icons.people,
                  '${tournament.currentPlayerCount}/${tournament.maxPlayers}'),
            ],
          ),
          const SizedBox(height: 16),
          // Progress bar for players
          LinearProgressIndicator(
            value: tournament.currentPlayerCount / tournament.maxPlayers,
            backgroundColor: AppTheme.backgroundColor,
            valueColor:
                const AlwaysStoppedAnimation<Color>(AppTheme.primaryColor),
          ),
          const SizedBox(height: 12),
          Text(
            '${tournament.spotsRemaining} spots remaining',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppTheme.textSecondary,
                ),
          ),
          const SizedBox(height: 12),
          Consumer<AuthProvider>(
            builder: (context, authProvider, child) {
              if (!authProvider.isAuthenticated) {
                return const SizedBox.shrink();
              }

              final isRegistered =
                  tournament.players.any((p) => p.id == authProvider.user?.id);

              return SizedBox(
                width: double.infinity,
                child: CustomButton(
                  text: isRegistered ? 'Registered' : 'Join',
                  onPressed: isRegistered || tournament.isFull
                      ? null
                      : () {
                          _joinTournament(tournament.id);
                        },
                  isSecondary: isRegistered,
                  height: 44,
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildInfoItem(IconData icon, String text) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: AppTheme.textSecondary),
        const SizedBox(width: 4),
        Text(
          text,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppTheme.textSecondary,
              ),
        ),
      ],
    );
  }

  Widget _buildEmptyState(String title, String subtitle) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.emoji_events_outlined,
            size: 80,
            color: AppTheme.textSecondary,
          ),
          const SizedBox(height: 16),
          Text(
            title,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  color: AppTheme.textPrimary,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            subtitle,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppTheme.textSecondary,
                ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'WAITING':
        return AppTheme.accentColor;
      case 'ACTIVE':
        return AppTheme.successColor;
      case 'FINISHED':
        return AppTheme.textSecondary;
      default:
        return AppTheme.textSecondary;
    }
  }

  void _joinTournament(String tournamentId) async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final tournamentProvider =
        Provider.of<TournamentProvider>(context, listen: false);

    if (!authProvider.isAuthenticated) return;

    final success = await tournamentProvider.registerInTournament(
      authProvider.token!,
      tournamentId,
    );

    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Successfully joined tournament!'),
          backgroundColor: AppTheme.successColor,
        ),
      );
    } else if (mounted && tournamentProvider.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(tournamentProvider.error!),
          backgroundColor: AppTheme.errorColor,
        ),
      );
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }
}
