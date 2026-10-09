/* The shapes Neon Loop works with. These match what the current single-file app
   stores, so events can move between the two while the rebuild is in progress. */

export type SegmentType = '' | 'break' | 'flex';

export interface Segment {
  k: string;               // stable key, survives reordering
  title: string;
  dur: number;             // planned length, seconds
  type?: SegmentType;      // break rows: fixed length, or able to shorten
  fix?: string;            // fixed start, "HH:MM"
  org?: string;            // organisation this segment is pledging for
  asset?: string;
  music?: string;
  who?: string;
  audio?: string;
  lx?: string;
  notes?: string;
  trans?: string;
}

export interface ActualTimes { s: number; e?: number; d?: number }   // started, ended (ms), shortened length (s)

export interface RunState {
  current: number;
  cued: number;
  startedAt: number;
  hold: boolean;
  t0?: number;                            // when the show actually started
  act?: Record<string, ActualTimes>;      // by segment key
}

export interface Org {
  id: string;
  name: string;
  match?: number;        // matched funding available
  target?: number;
  impactAmt?: number;    // "$250 funds one of …"
  impactUnit?: string;   // "… weeks of tutoring" (plural)
}

export interface Guest {
  id: string;
  kind?: 'guest' | 'org';
  first?: string;
  last?: string;
  company?: string;
  email?: string;
  phone?: string;
  table?: string;
  tag?: string;          // wristband or card ID
  arrived?: number;      // ms, 0 when not checked in
  walkIn?: boolean;
  newDonor?: boolean;
}

export interface Pledge {
  id: string;
  ts: number;
  org: string;
  amount: number;
  donorId: string;
  donorName: string;
  anon: boolean;
  fund: 'own' | 'budget';
  via?: string;          // who entered it, when it came from a remote
}

export interface TakeoverConfig {
  big: number;           // big pledge at or above; 0 = off
  step: number;          // milestone every; 0 = off
  target: boolean;
  match: boolean;
  ask: boolean;          // hold big pledges for approval
  people?: boolean;      // company and first-time counts (default on)
}

export interface Funding {
  mode: 'own' | 'budget';
  budget: number;
  allowance: number;
  company: string;
  allowOwn: boolean;
  screen?: 'full' | 'name' | 'amount';
  to?: TakeoverConfig;
}

export interface OrgTotal { donated: number; n: number; matched: number; total: number }
