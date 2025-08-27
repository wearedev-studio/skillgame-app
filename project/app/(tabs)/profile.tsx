import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Settings, Bell, Trophy, Target, Clock, Star, ChevronRight, CreditCard as Edit3, Share, Award } from 'lucide-react-native';

const achievements = [
  { id: 1, title: 'First Victory', icon: 'Trophy', unlocked: true },
  { id: 2, title: 'Speed Demon', icon: 'Target', unlocked: true },
  { id: 3, title: 'Perfectionist', icon: 'Star', unlocked: false },
  { id: 4, title: 'Marathon Player', icon: 'Clock', unlocked: true },
];

const stats = [
  { label: 'Games Played', value: '247', icon: 'Target' },
  { label: 'Win Rate', value: '78%', icon: 'Trophy' },
  { label: 'Total XP', value: '1,247', icon: 'Star' },
  { label: 'Avg. Time', value: '3.2m', icon: 'Clock' },
];

const menuItems = [
  { id: 1, title: 'Game History', icon: 'Clock', hasArrow: true },
  { id: 2, title: 'Achievements', icon: 'Award', hasArrow: true },
  { id: 3, title: 'Settings', icon: 'Settings', hasArrow: true },
  { id: 4, title: 'Notifications', icon: 'Bell', hasArrow: true },
  { id: 5, title: 'Share Profile', icon: 'Share', hasArrow: false },
];

export default function ProfileScreen() {
  const getIconComponent = (iconName: string, size: number = 20, color: string = '#FFFFFF') => {
    switch (iconName) {
      case 'Trophy': return <Trophy size={size} color={color} />;
      case 'Target': return <Target size={size} color={color} />;
      case 'Star': return <Star size={size} color={color} />;
      case 'Clock': return <Clock size={size} color={color} />;
      case 'Award': return <Award size={size} color={color} />;
      case 'Settings': return <Settings size={size} color={color} />;
      case 'Bell': return <Bell size={size} color={color} />;
      case 'Share': return <Share size={size} color={color} />;
      default: return null;
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient
          colors={['#1E293B', '#0F172A']}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <View style={styles.profileSection}>
              <Image
                source={{ uri: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=150' }}
                style={styles.profileImage}
              />
              <TouchableOpacity style={styles.editButton}>
                <Edit3 size={16} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.profileName}>Alex Rivera</Text>
              <Text style={styles.profileEmail}>alex.rivera@email.com</Text>
              
              <View style={styles.levelContainer}>
                <Text style={styles.levelText}>Level 12</Text>
                <View style={styles.levelBar}>
                  <View style={[styles.levelProgress, { width: '65%' }]} />
                </View>
                <Text style={styles.levelProgress}>1,247 / 1,800 XP</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>Statistics</Text>
          <View style={styles.statsGrid}>
            {stats.map((stat, index) => (
              <View key={index} style={styles.statCard}>
                <View style={styles.statIcon}>
                  {getIconComponent(stat.icon, 20, '#3B82F6')}
                </View>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Recent Achievements */}
        <View style={styles.achievementsContainer}>
          <Text style={styles.sectionTitle}>Recent Achievements</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.achievementsList}>
              {achievements.map((achievement) => (
                <View
                  key={achievement.id}
                  style={[
                    styles.achievementCard,
                    !achievement.unlocked && styles.achievementCardLocked,
                  ]}
                >
                  <View style={[
                    styles.achievementIcon,
                    !achievement.unlocked && styles.achievementIconLocked,
                  ]}>
                    {getIconComponent(
                      achievement.icon,
                      24,
                      achievement.unlocked ? '#F59E0B' : '#64748B'
                    )}
                  </View>
                  <Text style={[
                    styles.achievementTitle,
                    !achievement.unlocked && styles.achievementTitleLocked,
                  ]}>
                    {achievement.title}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Menu */}
        <View style={styles.menuContainer}>
          <Text style={styles.sectionTitle}>Account</Text>
          {menuItems.map((item) => (
            <TouchableOpacity key={item.id} style={styles.menuItem}>
              <View style={styles.menuLeft}>
                <View style={styles.menuIcon}>
                  {getIconComponent(item.icon, 20, '#94A3B8')}
                </View>
                <Text style={styles.menuTitle}>{item.title}</Text>
              </View>
              {item.hasArrow && <ChevronRight size={20} color="#64748B" />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout Button */}
        <View style={styles.logoutContainer}>
          <TouchableOpacity style={styles.logoutButton}>
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
  },
  headerContent: {
    alignItems: 'center',
  },
  profileSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  editButton: {
    position: 'absolute',
    top: 70,
    right: -10,
    backgroundColor: '#3B82F6',
    padding: 8,
    borderRadius: 16,
  },
  profileName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  profileEmail: {
    color: '#94A3B8',
    fontSize: 16,
    marginBottom: 20,
  },
  levelContainer: {
    alignItems: 'center',
    width: '100%',
  },
  levelText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  levelBar: {
    width: '60%',
    height: 8,
    backgroundColor: '#1E293B',
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  levelProgress: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 4,
  },
  levelProgressText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  statsContainer: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    width: '48%',
    minHeight: 100,
    justifyContent: 'center',
  },
  statIcon: {
    marginBottom: 8,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
  },
  achievementsContainer: {
    marginTop: 24,
  },
  achievementsList: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
  },
  achievementCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    width: 120,
  },
  achievementCardLocked: {
    opacity: 0.5,
  },
  achievementIcon: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 24,
    marginBottom: 8,
  },
  achievementIconLocked: {
    backgroundColor: '#374151',
  },
  achievementTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  achievementTitleLocked: {
    color: '#64748B',
  },
  menuContainer: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    marginRight: 12,
  },
  menuTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  logoutContainer: {
    paddingHorizontal: 20,
    marginTop: 24,
    paddingBottom: 100,
  },
  logoutButton: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});