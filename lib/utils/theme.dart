// This is a simple theme configuration file for the skillgame-app project
// The actual Flutter theme is located in skillgame_flutter/lib/utils/theme.dart

class AppColors {
  // Color constants that can be used across different parts of the project
  static const String primaryColor = '#3B82F6'; // Blue
  static const String secondaryColor = '#60A5FA'; // Light Blue
  static const String backgroundColor = '#0F172A'; // Dark Blue
  static const String surfaceColor = '#1E293B'; // Darker Blue
  static const String cardColor = '#1E293B';
  static const String textPrimary = '#FFFFFF';
  static const String textSecondary = '#94A3B8';
  static const String accentColor = '#F59E0B'; // Orange/Yellow
  static const String errorColor = '#EF4444';
  static const String successColor = '#10B981';
}

// Theme configuration that can be shared between different platforms
class ThemeConfig {
  static Map<String, String> getColorScheme() {
    return {
      'primary': AppColors.primaryColor,
      'secondary': AppColors.secondaryColor,
      'background': AppColors.backgroundColor,
      'surface': AppColors.surfaceColor,
      'card': AppColors.cardColor,
      'textPrimary': AppColors.textPrimary,
      'textSecondary': AppColors.textSecondary,
      'accent': AppColors.accentColor,
      'error': AppColors.errorColor,
      'success': AppColors.successColor,
    };
  }
}
