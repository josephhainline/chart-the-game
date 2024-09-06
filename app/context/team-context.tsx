import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Player = {
  id: string;
  name: string;
  number: string;
};

type Team = { name: string; players: Player[] };

const TeamContext = createContext<{
  team: Team | null;
  setTeam: (team: Team) => void;
  addPlayer: (player: Player) => void;
} | undefined>(undefined);

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const [team, setTeam] = useState<Team | null>(null);

  useEffect(() => {
    console.log('TeamProvider mounted');
    loadTeam();
  }, []);

  const loadTeam = async () => {
    try {
      const savedTeam = await AsyncStorage.getItem('team');
      console.log('Loaded team:', savedTeam);
      if (savedTeam) setTeam(JSON.parse(savedTeam));
    } catch (error) {
      console.error('Failed to load team:', error);
    }
  };

  const saveTeam = async (newTeam: Team) => {
    try {
      const teamJSON = JSON.stringify(newTeam);
      console.log('Saving team:', teamJSON);
      await AsyncStorage.setItem('team', teamJSON);
      setTeam(newTeam);
      console.log('Team saved successfully');
    } catch (error) {
      console.error('Failed to save team:', error);
    }
  };

  const addPlayer = (player: Player) => {
    console.log('Adding player:', player);
    if (team) {
      const newTeam = { ...team, players: [...team.players, player] };
      console.log('New team state:', newTeam);
      saveTeam(newTeam);
    } else {
      console.log('Creating new team with player:', player);
      const newTeam = { name: '', players: [player] };
      saveTeam(newTeam);
    }
  };

  return (
    <TeamContext.Provider value={{ team, setTeam: saveTeam, addPlayer }}>
      {children}
    </TeamContext.Provider>
  );
}

export const useTeam = () => {
  const context = useContext(TeamContext);
  if (context === undefined) {
    throw new Error('useTeam must be used within a TeamProvider');
  }
  return context;
};