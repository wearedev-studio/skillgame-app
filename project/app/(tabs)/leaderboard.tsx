import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Trophy, Medal, Crown, TrendingUp, Calendar } from 'lucide-react-native';

const periods = ['Today', 'Week', 'Month', 'All Time'];

const leaderboardData = [
  {
    id: 1,
    name: 'Sarah Chen',
    score: 15420,
    level: 24,
    rank: 1,
    avatar: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150',
    change: '+2',
  },
  {
    id: 2,
    name: 'Alex Rivera',
    score: 14850,
    level: 23,
    rank: 2,
    avatar: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=150',
    change: '0',
  },
  {
    id: 3,
    name: 'Marcus Kim',
    score: 14200,
    level: 22,
    rank: 3,
    avatar: 'https://images.pexels.com/photos/1212984/pexels-photo-1212984.jpeg?auto=compress&cs=tinysrgb&w=150',
    change: '-1',
  },
  {
    id: 4,
    name: 'Emma Johnson',
    score: 13950,
    level: 21,
    rank: 4,
    avatar: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=150',
    change: '+3',
  },
  {
    id: 5,
    name: 'David Park',
    score: 13700,
    level: 20,
    rank: 5,
    avatar: 'https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=150',
    change: '-2',
  },
];

export default function LeaderboardScreen() {
  const [selectedPeriod, setSelectedPeriod] = useState('Week');

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown size={20} color="#F59E0B" />;
      case 2:
        return <Medal size={20} color="#E5E7EB" />;
      case 3:
        return <Trophy size={20} color="#CD7C2F" />;
      default:
        return (
          <View style={styles.rankNumber}>
            <Text style={styles.rankNumberText}>{rank}</Text>
          </View>
        );
    }
  };

  const getChangeColor = (change: string) => {
    if (change.startsWith('+')) return '#10B981';
    if (change.startsWith('-')) return '#EF4444';
    return '#6B7280';
  };

  const getTopThreeStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' };
      case 2:
        return { backgroundColor: '#F3F4F6', borderColor: '#9CA3AF' };
      case 3:
        return { backgroundColor: '#FDF2F8', borderColor: '#EC4899' };
      default:
        return { backgroundColor: '#1E293B', borderColor: '#334155' };
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
            <Text style={styles.headerTitle}>Leaderboard</Text>
            <TouchableOpacity style={styles.calendarButton}>
              <Calendar size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Period Selector */}
        <View style={styles.periodContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.periodButtons}>
              {periods.map((period) => (
                <TouchableOpacity
                  key={period}
                  style={[
                    styles.periodButton,
                    selectedPeriod === period && styles.periodButtonActive,
                  ]}
                  onPress={() => setSelectedPeriod(period)}
                >
                  <Text
                    style={[
                      styles.periodText,
                      selectedPeriod === period && styles.periodTextActive,
                    ]}
                  >
                    {period}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Top 3 Podium */}
        <View style={styles.podiumContainer}>
          <LinearGradient
            colors={['#1E293B', '#0F172A']}
            style={styles.podium}
          >
            <Text style={styles.podiumTitle}>Top Performers</Text>
            <View style={styles.topThree}>
              {leaderboardData.slice(0, 3).map((player, index) => (
                <View key={player.id} style={[styles.podiumPlayer, index === 0 && styles.firstPlace]}>
                  <Image source={{ uri: player.avatar }} style={styles.podiumAvatar} />
                  <View style={styles.podiumRank}>
                    {getRankIcon(player.rank)}
                  </View>
                  <Text style={styles.podiumName}>{player.name.split(' ')[0]}</Text>
                  <Text style={styles.podiumScore}>{player.score.toLocaleString()}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>
        </View>

        {/* Full Leaderboard */}
        <View style={styles.leaderboardContainer}>
          <Text style={styles.sectionTitle}>All Rankings</Text>
          {leaderboardData.map((player) => (
            <View
              key={player.id}
              style={[
                styles.playerCard,
                player.rank <= 3 && { ...getTopThreeStyle(player.rank), borderWidth: 1 },
              ]}
            >
              <View style={styles.playerLeft}>
                <View style={styles.playerRank}>
                  {getRankIcon(player.rank)}
                </View>
                <Image source={{ uri: player.avatar }} style={styles.playerAvatar} />
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>{player.name}</Text>
                  <View style={styles.playerDetails}>
                    <Text style={styles.playerLevel}>Level {player.level}</Text>
                    <View style={[styles.changeIndicator, { backgroundColor: getChangeColor(player.change) }]}>
                      <TrendingUp size={10} color="#FFFFFF" />
                      <Text style={styles.changeText}>{player.change}</Text>
                    </View>
                  </View>
                </View>
              </View>
              <View style={styles.playerRight}>
                <Text style={styles.playerScore}>{player.score.toLocaleString()}</Text>
                <Text style={styles.scoreLabel}>XP</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Your Position */}
        <View style={styles.yourPositionContainer}>
          <LinearGradient
            colors={['#3B82F6', '#1D4ED8']}
            style={styles.yourPosition}
          >
            <Text style={styles.yourPositionTitle}>Your Position</Text>
            <View style={styles.yourPositionContent}>
              <View style={styles.yourRank}>
                <Text style={styles.yourRankNumber}>#247</Text>
                <Text style={styles.yourRankChange}>+15 this week</Text>
              </View>
              <View style={styles.yourStats}>
                <Text style={styles.yourScore}>1,247 XP</Text>
                <Text style={styles.yourLevel}>Level 12</Text>
              </View>
            </View>
          </LinearGradient>
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
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
  },
  calendarButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    borderRadius: 12,
  },
  periodContainer: {
    paddingVertical: 16,
  },
  periodButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
  },
  periodButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1E293B',
  },
  periodButtonActive: {
    backgroundColor: '#3B82F6',
  },
  periodText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  periodTextActive: {
    color: '#FFFFFF',
  },
  podiumContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  podium: {
    borderRadius: 16,
    padding: 20,
  },
  podiumTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  topThree: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
  },
  podiumPlayer: {
    alignItems: 'center',
  },
  firstPlace: {
    transform: [{ scale: 1.1 }],
  },
  podiumAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
  },
  podiumRank: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FFFFFF',
    padding: 4,
    borderRadius: 12,
  },
  podiumName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  podiumScore: {
    color: '#94A3B8',
    fontSize: 12,
  },
  leaderboardContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  playerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  playerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  playerRank: {
    width: 32,
    marginRight: 12,
    alignItems: 'center',
  },
  rankNumber: {
    backgroundColor: '#374151',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNumberText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  playerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  playerDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playerLevel: {
    color: '#94A3B8',
    fontSize: 12,
  },
  changeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  changeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  playerRight: {
    alignItems: 'flex-end',
  },
  playerScore: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scoreLabel: {
    color: '#94A3B8',
    fontSize: 12,
  },
  yourPositionContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  yourPosition: {
    borderRadius: 16,
    padding: 20,
  },
  yourPositionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  yourPositionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  yourRank: {
    alignItems: 'flex-start',
  },
  yourRankNumber: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  yourRankChange: {
    color: '#E0E7FF',
    fontSize: 12,
    marginTop: 4,
  },
  yourStats: {
    alignItems: 'flex-end',
  },
  yourScore: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  yourLevel: {
    color: '#E0E7FF',
    fontSize: 14,
    marginTop: 4,
  },
});