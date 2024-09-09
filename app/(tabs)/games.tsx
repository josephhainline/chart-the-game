"use client"

import React, { useState, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Text, View } from '@/components/Themed';
import { Button, Card, FAB } from 'react-native-paper';
import { ScrollView } from 'react-native-gesture-handler';
import { format } from "date-fns"

type Game = {
  id: string
  date: Date
  opponent: string
  isAway: boolean
  status: "Won" | "Lost" | "Scoring" | "Scheduled"
  score?: {
    home: number
    away: number
  }
}

const mockGames: Game[] = [
  {
    id: "1",
    date: new Date("2024-01-01"),
    opponent: "Team A",
    isAway: false,
    status: "Scheduled",
    score: { home: 0, away: 0 }
  },
  {
    id: "2",
    date: new Date("2024-01-02"),
    opponent: "Team B",
    isAway: true,
    status: "Scheduled",
    score: { home: 0, away: 0 }
  },
  {
    id: "3",
    date: new Date("2024-01-03"),
    opponent: "Team C",
    isAway: false,
    status: "Won",
    score: { home: 3, away: 1 }
  },
  {
    id: "4",
    date: new Date("2024-01-04"),
    opponent: "Team D",
    isAway: true,
    status: "Lost",
    score: { home: 0, away: 2 }
  },
  {
    id: "5",
    date: new Date("2024-01-05"),
    opponent: "Team E",
    isAway: false,
    status: "Scoring",
    score: { home: 2, away: 2 }
  },
  {
    id: "6",
    date: new Date("2024-01-06"),
    opponent: "Team F",
    isAway: true,
    status: "Scheduled",
    score: { home: 0, away: 0 }
  },
]

export default function GameTrackerScreen() {
  const [games, setGames] = useState<Game[]>([])
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)

  useEffect(() => {
    const storedGames = localStorage.getItem('games')
    if (storedGames) {
      setGames(JSON.parse(storedGames, (key, value) => {
        if (key === 'date') return new Date(value);
        return value;
      }))
    } else {
      setGames(mockGames)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('games', JSON.stringify(games))
  }, [games])

  const sortedGames = [...games].sort((a, b) => a.date.getTime() - b.date.getTime())

  const handleScoreClick = (game: Game) => {
    setSelectedGame(game)
  }

  const updateGameScore = (gameId: string, homeScore: number, awayScore: number) => {
    setGames(games.map(game => 
      game.id === gameId 
        ? { ...game, score: { home: homeScore, away: awayScore }, status: "Scoring" }
        : game
    ))
  }

  const addNewGame = () => {
    const newGame: Game = {
      id: Date.now().toString(),
      date: new Date(),
      opponent: "New Opponent",
      isAway: false,
      status: "Scheduled",
      score: { home: 0, away: 0 }
    };
    setGames([...games, newGame]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Game Tracker</Text>
      <ScrollView style={styles.scrollView}>
        <View style={styles.gameList}>
          {sortedGames.map((game) => (
            <Card key={game.id} style={styles.gameItem}>
              <Card.Content style={styles.gameContent}>
                <View style={styles.gameInfo}>
                  <Text style={styles.dateText}>{format(game.date, 'MMM d, yyyy')}</Text>
                  <Text>{game.isAway ? '@ ' : 'vs '}{game.opponent}</Text>
                </View>
                <View>
                  {game.status === "Won" || game.status === "Lost" ? (
                    <Text style={[styles.statusText, game.status === "Won" ? styles.wonStatus : styles.lostStatus]}>
                      {game.status}
                    </Text>
                  ) : (
                    <Button mode="outlined" onPress={() => handleScoreClick(game)}>
                      {game.status === "Scoring" ? "Update Score" : "Score"}
                    </Button>
                  )}
                </View>
              </Card.Content>
            </Card>
          ))}
        </View>
      </ScrollView>
      <FAB
        style={styles.fab}
        icon="plus"
        onPress={addNewGame}
        label="New Game"
      />
    </View>
  );
}

function ScoringModal({ game, updateScore }: { game: Game, updateScore: (gameId: string, homeScore: number, awayScore: number) => void }) {
  // ... ScoringModal component implementation ...
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  scrollView: {
    flex: 1,
  },
  gameList: {
    flex: 1,
  },
  gameItem: {
    marginBottom: 16,
  },
  gameContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gameInfo: {
    flexDirection: 'column',
  },
  dateText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statusText: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 12,
  },
  wonStatus: {
    backgroundColor: '#d1fae5',
    color: '#065f46',
  },
  lostStatus: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
});
