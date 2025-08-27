import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:skillgame_flutter/providers/auth_provider.dart';
import 'package:skillgame_flutter/providers/user_provider.dart';
import 'package:skillgame_flutter/models/user_model.dart'; // Добавляем импорт для GameRecord
import 'package:skillgame_flutter/utils/theme.dart';
import 'package:skillgame_flutter/widgets/custom_button.dart';
import 'package:skillgame_flutter/widgets/custom_text_field.dart';

class ProfileSettingsScreen extends StatefulWidget {
  const ProfileSettingsScreen({super.key});

  @override
  State<ProfileSettingsScreen> createState() => _ProfileSettingsScreenState();
}

class _ProfileSettingsScreenState extends State<ProfileSettingsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController =
        TabController(length: 5, vsync: this); // Увеличиваем до 5 табов

    WidgetsBinding.instance.addPostFrameCallback((_) {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final userProvider = Provider.of<UserProvider>(context, listen: false);

      if (authProvider.isAuthenticated) {
        userProvider.loadGameHistory(authProvider.token!);
        userProvider.loadTransactionHistory(authProvider.token!);
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
                  _buildProfileTab(),
                  _buildStatsTab(), // Новый таб со статистикой
                  _buildSecurityTab(),
                  _buildWalletTab(),
                  _buildTransactionsTab(),
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
        children: [
          IconButton(
            onPressed: () => Navigator.of(context).pop(),
            icon: const Icon(Icons.arrow_back, color: AppTheme.textPrimary),
          ),
          const SizedBox(width: 8),
          Text(
            'Profile Settings',
            style: Theme.of(context).textTheme.displaySmall?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textPrimary,
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
        labelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
        isScrollable: true,
        tabs: const [
          Tab(text: 'Profile'),
          Tab(text: 'Stats'),
          Tab(text: 'Security'),
          Tab(text: 'Wallet'),
          Tab(text: 'Transactions'),
        ],
      ),
    );
  }

  Widget _buildProfileTab() {
    return Consumer<AuthProvider>(
      builder: (context, authProvider, child) {
        final user = authProvider.user;
        final _usernameController =
            TextEditingController(text: user?.username ?? '');
        final _emailController = TextEditingController(text: user?.email ?? '');
        final _displayNameController =
            TextEditingController(text: user?.username ?? '');

        return SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Profile Information',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textPrimary,
                    ),
              ),
              const SizedBox(height: 20),

              // Profile picture section
              Center(
                child: Stack(
                  children: [
                    Container(
                      width: 120,
                      height: 120,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: const LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            AppTheme.primaryColor,
                            AppTheme.secondaryColor
                          ],
                        ),
                      ),
                      child: const Icon(
                        Icons.person,
                        size: 60,
                        color: Colors.white,
                      ),
                    ),
                    Positioned(
                      bottom: 0,
                      right: 0,
                      child: Container(
                        decoration: const BoxDecoration(
                          color: AppTheme.primaryColor,
                          shape: BoxShape.circle,
                        ),
                        padding: const EdgeInsets.all(8),
                        child: const Icon(
                          Icons.camera_alt,
                          size: 20,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 30),

              // Username field
              CustomTextField(
                label: 'Username',
                controller: _usernameController,
                onChanged: (value) {
                  // Handle username change
                },
              ),
              const SizedBox(height: 16),

              // Email field
              CustomTextField(
                label: 'Email',
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                onChanged: (value) {
                  // Handle email change
                },
              ),
              const SizedBox(height: 16),

              // Display name field
              CustomTextField(
                label: 'Display Name',
                controller: _displayNameController,
                onChanged: (value) {
                  // Handle display name change
                },
              ),
              const SizedBox(height: 30),

              CustomButton(
                text: 'Save Changes',
                onPressed: () {
                  // Handle save changes
                  _showSuccessMessage('Profile updated successfully!');
                },
                width: double.infinity,
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildStatsTab() {
    return Consumer<UserProvider>(
      builder: (context, userProvider, child) {
        final gameHistory = userProvider.gameHistory;

        if (userProvider.isLoadingHistory) {
          return const Center(child: CircularProgressIndicator());
        }

        if (gameHistory.isEmpty) {
          return _buildEmptyState(
            'No Game History',
            'Your game statistics will appear here',
            Icons.sports_esports_outlined,
          );
        }

        // Вычисляем статистику
        final totalGames = gameHistory.length;
        final wins = gameHistory.where((game) => game.status == 'WON').length;
        final losses =
            gameHistory.where((game) => game.status == 'LOST').length;
        final draws = gameHistory.where((game) => game.status == 'DRAW').length;
        final winRate = totalGames > 0 ? (wins / totalGames * 100) : 0.0;

        return SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Game Statistics',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textPrimary,
                    ),
              ),
              const SizedBox(height: 20),

              // Статистика в карточках
              Row(
                children: [
                  Expanded(
                    child: _buildStatCard(
                      'Total Games',
                      totalGames.toString(),
                      Icons.games,
                      AppTheme.primaryColor,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildStatCard(
                      'Win Rate',
                      '${winRate.toStringAsFixed(1)}%',
                      Icons.trending_up,
                      AppTheme.successColor,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _buildStatCard(
                      'Wins',
                      wins.toString(),
                      Icons.emoji_events,
                      AppTheme.successColor,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildStatCard(
                      'Losses',
                      losses.toString(),
                      Icons.close,
                      AppTheme.errorColor,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Recent Games
              Text(
                'Recent Games',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textPrimary,
                    ),
              ),
              const SizedBox(height: 16),

              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount:
                    gameHistory.take(10).length, // Показываем последние 10 игр
                separatorBuilder: (context, index) =>
                    const SizedBox(height: 12),
                itemBuilder: (context, index) {
                  final game = gameHistory[index];
                  return _buildGameHistoryCard(game);
                },
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildStatCard(
      String title, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surfaceColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 24),
          const SizedBox(height: 8),
          Text(
            value,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textPrimary,
                ),
          ),
          Text(
            title,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppTheme.textSecondary,
                ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildGameHistoryCard(GameRecord game) {
    Color resultColor;
    IconData resultIcon;
    String resultText;

    switch (game.status.toUpperCase()) {
      case 'WON':
        resultColor = AppTheme.successColor;
        resultIcon = Icons.emoji_events;
        resultText = 'Won';
        break;
      case 'LOST':
        resultColor = AppTheme.errorColor;
        resultIcon = Icons.close;
        resultText = 'Lost';
        break;
      case 'DRAW':
        resultColor = AppTheme.textSecondary;
        resultIcon = Icons.remove;
        resultText = 'Draw';
        break;
      default:
        resultColor = AppTheme.textSecondary;
        resultIcon = Icons.help_outline;
        resultText = game.status;
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surfaceColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: resultColor.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(resultIcon, color: resultColor, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  game.gameName,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppTheme.textPrimary,
                      ),
                ),
                Text(
                  game.createdAt
                      .toString()
                      .split(' ')[0], // Показываем только дату
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppTheme.textSecondary,
                      ),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                resultText,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: resultColor,
                    ),
              ),
              if (game.amountChanged > 0)
                Text(
                  '+\$${game.amountChanged.toStringAsFixed(2)}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppTheme.successColor,
                      ),
                )
              else if (game.amountChanged < 0)
                Text(
                  '\$${game.amountChanged.toStringAsFixed(2)}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppTheme.errorColor,
                      ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSecurityTab() {
    final currentPasswordController = TextEditingController();
    final newPasswordController = TextEditingController();
    final confirmPasswordController = TextEditingController();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Security Settings',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textPrimary,
                ),
          ),
          const SizedBox(height: 20),

          // Change Password Section
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppTheme.surfaceColor,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.lock, color: AppTheme.primaryColor),
                    const SizedBox(width: 8),
                    Text(
                      'Change Password',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: AppTheme.textPrimary,
                          ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                CustomTextField(
                  label: 'Current Password',
                  controller: currentPasswordController,
                  obscureText: true,
                ),
                const SizedBox(height: 16),
                CustomTextField(
                  label: 'New Password',
                  controller: newPasswordController,
                  obscureText: true,
                ),
                const SizedBox(height: 16),
                CustomTextField(
                  label: 'Confirm New Password',
                  controller: confirmPasswordController,
                  obscureText: true,
                ),
                const SizedBox(height: 20),
                CustomButton(
                  text: 'Update Password',
                  onPressed: () {
                    _changePassword(
                      currentPasswordController.text,
                      newPasswordController.text,
                      confirmPasswordController.text,
                    );
                  },
                  width: double.infinity,
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Account Verification Section
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppTheme.surfaceColor,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.verified_user,
                        color: AppTheme.successColor),
                    const SizedBox(width: 8),
                    Text(
                      'Account Verification',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: AppTheme.textPrimary,
                          ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                _buildVerificationItem(
                  'Email Verification',
                  'Verify your email address',
                  true,
                  () {
                    _showSuccessMessage('Verification email sent!');
                  },
                ),
                _buildVerificationItem(
                  'Phone Verification',
                  'Add and verify your phone number',
                  false,
                  () {
                    _showDialog('Phone Verification',
                        'Please enter your phone number to verify.');
                  },
                ),
                _buildVerificationItem(
                  'Two-Factor Authentication',
                  'Enable 2FA for extra security',
                  false,
                  () {
                    _showDialog('Two-Factor Authentication',
                        'Set up 2FA using an authenticator app.');
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVerificationItem(
      String title, String subtitle, bool isVerified, VoidCallback onTap) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: AppTheme.backgroundColor,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Expanded(
            flex: 3,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppTheme.textPrimary,
                      ),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppTheme.textSecondary,
                      ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          if (isVerified)
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppTheme.successColor.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.check_circle,
                color: AppTheme.successColor,
                size: 24,
              ),
            )
          else
            SizedBox(
              width: 80,
              height: 36,
              child: CustomButton(
                text: 'Verify',
                onPressed: onTap,
                isSecondary: true,
                height: 36,
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildWalletTab() {
    return Consumer<AuthProvider>(
      builder: (context, authProvider, child) {
        final user = authProvider.user;
        return SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Wallet',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textPrimary,
                    ),
              ),
              const SizedBox(height: 20),

              // Balance Card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [AppTheme.primaryColor, AppTheme.secondaryColor],
                  ),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Current Balance',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Colors.white70,
                          ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '\$${user?.balance.toStringAsFixed(2) ?? '0.00'}',
                      style: Theme.of(context).textTheme.displaySmall?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: CustomButton(
                            text: 'Add Funds',
                            onPressed: _showAddFundsDialog,
                            backgroundColor: Colors.white,
                            textColor: AppTheme.primaryColor,
                            height: 40,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: CustomButton(
                            text: 'Withdraw',
                            onPressed: _showWithdrawDialog,
                            backgroundColor: Colors.transparent,
                            textColor: Colors.white,
                            isSecondary: true,
                            height: 40,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Payment History
              Text(
                'Payment History',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textPrimary,
                    ),
              ),
              const SizedBox(height: 16),

              Consumer<UserProvider>(
                builder: (context, userProvider, child) {
                  final transactions =
                      userProvider.transactionHistory.take(5).toList();

                  if (transactions.isEmpty) {
                    return Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: AppTheme.surfaceColor,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        'No payment history available',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: AppTheme.textSecondary,
                            ),
                        textAlign: TextAlign.center,
                      ),
                    );
                  }

                  return Container(
                    decoration: BoxDecoration(
                      color: AppTheme.surfaceColor,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      children: transactions.asMap().entries.map((entry) {
                        final index = entry.key;
                        final transaction = entry.value;
                        final isCredit = transaction.type == 'CREDIT';

                        return Column(
                          children: [
                            _buildPaymentHistoryItem(
                              transaction.type == 'CREDIT'
                                  ? 'Deposit'
                                  : 'Withdrawal',
                              '${isCredit ? '+' : '-'}\$${transaction.amount.toStringAsFixed(2)}',
                              transaction.createdAt.toString().split(' ')[0],
                              isCredit ? Icons.add_circle : Icons.remove_circle,
                              isCredit
                                  ? AppTheme.successColor
                                  : AppTheme.errorColor,
                            ),
                            if (index < transactions.length - 1)
                              const Divider(
                                  height: 1, color: AppTheme.backgroundColor),
                          ],
                        );
                      }).toList(),
                    ),
                  );
                },
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildPaymentHistoryItem(String title, String amount, String date,
      IconData icon, Color iconColor) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: iconColor.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: iconColor, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppTheme.textPrimary,
                      ),
                ),
                Text(
                  date,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppTheme.textSecondary,
                      ),
                ),
              ],
            ),
          ),
          Text(
            amount,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: amount.startsWith('+')
                      ? AppTheme.successColor
                      : AppTheme.errorColor,
                ),
          ),
        ],
      ),
    );
  }

  Widget _buildTransactionsTab() {
    return Consumer<UserProvider>(
      builder: (context, userProvider, child) {
        final transactions = userProvider.transactionHistory;

        if (userProvider.isLoadingHistory) {
          return const Center(child: CircularProgressIndicator());
        }

        if (transactions.isEmpty) {
          return _buildEmptyState(
            'No Transactions',
            'Your financial transactions will appear here',
            Icons.receipt_long_outlined,
          );
        }

        return ListView.separated(
          padding: const EdgeInsets.all(20),
          itemCount: transactions.length,
          separatorBuilder: (context, index) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final transaction = transactions[index];
            return _buildTransactionCard(transaction);
          },
        );
      },
    );
  }

  Widget _buildTransactionCard(transaction) {
    final isCredit = transaction.type == 'CREDIT';
    final color = isCredit ? AppTheme.successColor : AppTheme.errorColor;
    final icon = isCredit ? Icons.add_circle : Icons.remove_circle;
    final amount =
        '${isCredit ? '+' : '-'}\$${transaction.amount.toStringAsFixed(2)}';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surfaceColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  transaction.description ?? 'Transaction',
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppTheme.textPrimary,
                      ),
                ),
                Text(
                  transaction.createdAt ?? 'Recent',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppTheme.textSecondary,
                      ),
                ),
              ],
            ),
          ),
          Text(
            amount,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: color,
                ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(String title, String subtitle, IconData icon) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            icon,
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

  void _changePassword(
      String currentPassword, String newPassword, String confirmPassword) {
    if (currentPassword.isEmpty ||
        newPassword.isEmpty ||
        confirmPassword.isEmpty) {
      _showErrorMessage('Please fill in all fields');
      return;
    }

    if (newPassword != confirmPassword) {
      _showErrorMessage('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      _showErrorMessage('Password must be at least 6 characters');
      return;
    }

    // TODO: Implement password change API call
    _showSuccessMessage('Password changed successfully!');
  }

  void _showAddFundsDialog() {
    final amountController = TextEditingController();

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppTheme.surfaceColor,
        title: Text(
          'Add Funds',
          style: TextStyle(color: AppTheme.textPrimary),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CustomTextField(
              label: 'Amount (\$)',
              controller: amountController,
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 16),
            Text(
              'Select payment method:',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppTheme.textPrimary,
                  ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: CustomButton(
                    text: 'Card',
                    onPressed: () {
                      Navigator.of(context).pop();
                      _showSuccessMessage('Funds added successfully!');
                    },
                    height: 40,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: CustomButton(
                    text: 'PayPal',
                    onPressed: () {
                      Navigator.of(context).pop();
                      _showSuccessMessage('Funds added successfully!');
                    },
                    isSecondary: true,
                    height: 40,
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child:
                Text('Cancel', style: TextStyle(color: AppTheme.textSecondary)),
          ),
        ],
      ),
    );
  }

  void _showWithdrawDialog() {
    _showDialog('Withdraw Funds', 'Withdrawal feature will be available soon.');
  }

  void _showDialog(String title, String message) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppTheme.surfaceColor,
        title: Text(title, style: TextStyle(color: AppTheme.textPrimary)),
        content: Text(message, style: TextStyle(color: AppTheme.textSecondary)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text('OK', style: TextStyle(color: AppTheme.primaryColor)),
          ),
        ],
      ),
    );
  }

  void _showSuccessMessage(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: AppTheme.successColor,
      ),
    );
  }

  void _showErrorMessage(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: AppTheme.errorColor,
      ),
    );
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }
}
