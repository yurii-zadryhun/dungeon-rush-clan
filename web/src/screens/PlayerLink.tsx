import React from 'react';
import { normalizeName, type Account } from '../api';
import './PlayerLink.css';

const Identity = React.createContext<Account | null>(null);

export function PlayerIdentityProvider({account,children}: {
  account: Account; children: React.ReactNode;
}) {
  return <Identity.Provider value={account}>{children}</Identity.Provider>;
}
export function useIsCurrentPlayer(id: number, name: string): boolean {
  const account = React.useContext(Identity);
  if (!account) return false;
  return account.playerId === id ||
    (account.playerId === null && normalizeName(account.username) === normalizeName(name));
}
export function PlayerLink({id,name,className = ''}: {
  id: number; name: string; className?: string;
}) {
  const isMe = useIsCurrentPlayer(id, name);
  return <a href={'#/players/' + id}
    className={['player-link', isMe && 'is-me', className].filter(Boolean).join(' ')}>{name}</a>;
}
