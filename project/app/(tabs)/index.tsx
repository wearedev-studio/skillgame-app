import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Play, Star, TrendingUp, Zap } from 'lucide-react-native';

const { width } = Dimensions.get('window');

const featuredGames = [
  {
    id: 1,
    title: 'Neural Strike',
    category: 'Action',
    rating: 4.8,
    players: '12K+',
    image: 'https://images.pexels.com/photos/442576/pexels-photo-442576.jpeg?auto=compress&cs=tinysrgb&w=400',
  },
  {
    id: 2,
    title: 'Mind Puzzle',
    category: 'Strategy',
    rating: 4.6,
    players: '8.5K+',
    image: 'https://images.pexels.com/photos/163064/play-stone-network-networked-interactive-163064.jpeg?auto=compress&cs=tinysrgb&w=400',
  },
];

const quickGames = [
  { id: 1, title: 'Speed Math', icon: 'Zap', time: '2 min' },
  { id: 2, title: 'Memory Test', icon: 'Star', time: '3 min' },
  { id: 3, title: 'Pattern Match', icon: 'TrendingUp', time: '1 min' },
];

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient
          colors={['#1E293B', '#0F172A']}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.greeting}>Good evening,</Text>
              <Text style={styles.userName}>Alex</Text>
            </View>
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>1,247</Text>
                <Text style={styles.statLabel}>XP</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>12</Text>
                <Text style={styles.statLabel}>Level</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Daily Challenge */}
        <View style={styles.section}>
          <LinearGradient
            colors={['#3B82F6', '#1D4ED8']}
            style={styles.challengeCard}
          >
            <View style={styles.challengeContent}>
              <View style={styles.challengeInfo}>
                <Text style={styles.challengeTitle}>Daily Challenge</Text>
                <Text style={styles.challengeDesc}>
                  Complete 5 games to earn bonus XP
                </Text>
                <View style={styles.progressBar}>
                  <View style={[styles.progress, { width: '60%' }]} />
                </View>
                <Text style={styles.progressText}>3/5 completed</Text>
              </View>
              <TouchableOpacity style={styles.playButton}>
                <Play size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

        {/* Quick Games */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Games</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.quickGamesContainer}>
              {quickGames.map((game) => (
                <TouchableOpacity key={game.id} style={styles.quickGameCard}>
                  <LinearGradient
                    colors={['#1E293B', '#0F172A']}
                    style={styles.quickGameGradient}
                  >
                    <Zap size={24} color="#60A5FA" />
                    <Text style={styles.quickGameTitle}>{game.title}</Text>
                    <Text style={styles.quickGameTime}>{game.time}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Featured Games */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Featured Games</Text>
          {featuredGames.map((game) => (
            <TouchableOpacity key={game.id} style={styles.gameCard}>
              <Image source={{ uri: game.image }} style={styles.gameImage} />
              <View style={styles.gameInfo}>
                <Text style={styles.gameTitle}>{game.title}</Text>
                <Text style={styles.gameCategory}>{game.category}</Text>
                <View style={styles.gameStats}>
                  <View style={styles.gameStat}>
                    <Star size={14} color="#F59E0B" />
                    <Text style={styles.gameRating}>{game.rating}</Text>
                  </View>
                  <Text style={styles.gamePlayers}>{game.players} players</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.gamePlayButton}>
                <Play size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
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
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    color: '#94A3B8',
    fontSize: 16,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#475569',
    marginHorizontal: 16,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  challengeCard: {
    borderRadius: 16,
    padding: 20,
  },
  challengeContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  challengeInfo: {
    flex: 1,
  },
  challengeTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  challengeDesc: {
    color: '#E0E7FF',
    fontSize: 14,
    marginTop: 4,
    marginBottom: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
    marginBottom: 6,
  },
  progress: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
  },
  progressText: {
    color: '#E0E7FF',
    fontSize: 12,
  },
  playButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 12,
    borderRadius: 12,
    marginLeft: 16,
  },
  quickGamesContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  quickGameCard: {
    width: 120,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
  },
  quickGameGradient: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickGameTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
  quickGameTime: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 4,
  },
  gameCard: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  gameImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  gameInfo: {
    flex: 1,
    marginLeft: 12,
  },
  gameTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  gameCategory: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 2,
  },
  gameStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  gameStat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  gameRating: {
    color: '#F59E0B',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '600',
  },
  gamePlayers: {
    color: '#64748B',
    fontSize: 12,
  },
  gamePlayButton: {
    backgroundColor: '#3B82F6',
    padding: 10,
    borderRadius: 8,
  },
});