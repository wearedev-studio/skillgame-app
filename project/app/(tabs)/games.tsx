import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Search, Filter, Star, Play, Clock, Users } from 'lucide-react-native';

const categories = ['All', 'Action', 'Strategy', 'Puzzle', 'Arcade'];

const games = [
  {
    id: 1,
    title: 'Neural Strike',
    category: 'Action',
    rating: 4.8,
    duration: '5 min',
    players: 1247,
    difficulty: 'Hard',
    image: 'https://images.pexels.com/photos/442576/pexels-photo-442576.jpeg?auto=compress&cs=tinysrgb&w=400',
  },
  {
    id: 2,
    title: 'Mind Puzzle',
    category: 'Strategy',
    rating: 4.6,
    duration: '3 min',
    players: 856,
    difficulty: 'Medium',
    image: 'https://images.pexels.com/photos/163064/play-stone-network-networked-interactive-163064.jpeg?auto=compress&cs=tinysrgb&w=400',
  },
  {
    id: 3,
    title: 'Speed Math',
    category: 'Puzzle',
    rating: 4.7,
    duration: '2 min',
    players: 2103,
    difficulty: 'Easy',
    image: 'https://images.pexels.com/photos/714698/pexels-photo-714698.jpeg?auto=compress&cs=tinysrgb&w=400',
  },
  {
    id: 4,
    title: 'Color Match',
    category: 'Arcade',
    rating: 4.5,
    duration: '4 min',
    players: 673,
    difficulty: 'Easy',
    image: 'https://images.pexels.com/photos/1148820/pexels-photo-1148820.jpeg?auto=compress&cs=tinysrgb&w=400',
  },
];

export default function GamesScreen() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchText, setSearchText] = useState('');

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy': return '#10B981';
      case 'Medium': return '#F59E0B';
      case 'Hard': return '#EF4444';
      default: return '#6B7280';
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
          <Text style={styles.headerTitle}>Games</Text>
          
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Search size={20} color="#64748B" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search games..."
                placeholderTextColor="#64748B"
                value={searchText}
                onChangeText={setSearchText}
              />
            </View>
            <TouchableOpacity style={styles.filterButton}>
              <Filter size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Categories */}
        <View style={styles.categoriesContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.categories}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryButton,
                    selectedCategory === category && styles.categoryButtonActive,
                  ]}
                  onPress={() => setSelectedCategory(category)}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      selectedCategory === category && styles.categoryTextActive,
                    ]}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Games Grid */}
        <View style={styles.gamesContainer}>
          {games.map((game) => (
            <View key={game.id} style={styles.gameCard}>
              <Image source={{ uri: game.image }} style={styles.gameImage} />
              
              <LinearGradient
                colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.8)']}
                style={styles.gameOverlay}
              >
                <View style={styles.gameInfo}>
                  <View style={styles.gameHeader}>
                    <Text style={styles.gameTitle}>{game.title}</Text>
                    <View style={styles.gameDifficulty}>
                      <View
                        style={[
                          styles.difficultyDot,
                          { backgroundColor: getDifficultyColor(game.difficulty) },
                        ]}
                      />
                      <Text style={styles.difficultyText}>{game.difficulty}</Text>
                    </View>
                  </View>
                  
                  <Text style={styles.gameCategory}>{game.category}</Text>
                  
                  <View style={styles.gameStats}>
                    <View style={styles.gameStat}>
                      <Star size={12} color="#F59E0B" />
                      <Text style={styles.gameStatText}>{game.rating}</Text>
                    </View>
                    <View style={styles.gameStat}>
                      <Clock size={12} color="#64748B" />
                      <Text style={styles.gameStatText}>{game.duration}</Text>
                    </View>
                    <View style={styles.gameStat}>
                      <Users size={12} color="#64748B" />
                      <Text style={styles.gameStatText}>{game.players}</Text>
                    </View>
                  </View>
                </View>
                
                <TouchableOpacity style={styles.playButton}>
                  <Play size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </LinearGradient>
            </View>
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
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 12,
  },
  filterButton: {
    backgroundColor: '#3B82F6',
    padding: 12,
    borderRadius: 12,
  },
  categoriesContainer: {
    paddingVertical: 16,
  },
  categories: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
  },
  categoryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1E293B',
  },
  categoryButtonActive: {
    backgroundColor: '#3B82F6',
  },
  categoryText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  categoryTextActive: {
    color: '#FFFFFF',
  },
  gamesContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  gameCard: {
    height: 200,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  gameImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  gameOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  gameInfo: {
    flex: 1,
  },
  gameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  gameTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  gameDifficulty: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  difficultyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  difficultyText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  gameCategory: {
    color: '#94A3B8',
    fontSize: 14,
    marginBottom: 8,
  },
  gameStats: {
    flexDirection: 'row',
    gap: 12,
  },
  gameStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gameStatText: {
    color: '#E2E8F0',
    fontSize: 12,
  },
  playButton: {
    backgroundColor: '#3B82F6',
    padding: 12,
    borderRadius: 12,
    marginLeft: 16,
  },
});