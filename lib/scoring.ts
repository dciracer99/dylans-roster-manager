export interface Interaction {
  id: string;
  user_id: string;
  contact_id: string;
  direction: "sent" | "received";
  content: string;
  platform: string | null;
  interaction_type: string | null;
  logged_at: string;
}

export function calculateCharismaScore(interactions: Interaction[]): number {
  if (interactions.length === 0) return 50;

  let score = 100;

  // Sort by date descending
  const sorted = [...interactions].sort(
    (a, b) =>
      new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()
  );

  const lastInteraction = sorted[0];
  const now = new Date();
  const lastDate = new Date(lastInteraction.logged_at);
  const daysSince = Math.floor(
    (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Days since last interaction penalty
  if (daysSince <= 1) {
    score -= 0;
  } else if (daysSince <= 3) {
    score -= 10;
  } else if (daysSince <= 7) {
    score -= 20;
  } else if (daysSince <= 14) {
    score -= 35;
  } else {
    score -= 50;
  }

  // Direction bonuses/penalties
  if (lastInteraction.direction === "received") {
    score -= 15; // they texted, you haven't replied
  } else {
    score += 5;
  }

  // Volume bonus: more than 5 interactions in last 7 days
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recentInteractions = interactions.filter(
    (i) => new Date(i.logged_at) >= sevenDaysAgo
  );
  if (recentInteractions.length > 5) {
    score += 10;
  }

  // Reciprocity bonus/penalty: balance of sent vs received
  const totalSent = interactions.filter((i) => i.direction === "sent").length;
  const totalReceived = interactions.filter(
    (i) => i.direction === "received"
  ).length;
  const total = totalSent + totalReceived;
  if (total >= 4) {
    const ratio = totalSent / total;
    if (ratio > 0.75) {
      score -= 10; // you're chasing — over 75% of messages are yours
    } else if (ratio < 0.25) {
      score -= 5; // they're doing all the work
    } else if (ratio >= 0.35 && ratio <= 0.65) {
      score += 5; // healthy balance
    }
  }

  // Streak bonus: interactions on 3+ different days in last 7 days
  const recentDays = new Set(
    recentInteractions.map((i) =>
      new Date(i.logged_at).toISOString().slice(0, 10)
    )
  );
  if (recentDays.size >= 3) {
    score += 5;
  }

  // Date/meetup bonus
  const dateCount = interactions.filter(
    (i) =>
      i.interaction_type === "date" ||
      i.interaction_type === "hangout" ||
      i.interaction_type === "meetup"
  ).length;
  if (dateCount > 0) {
    score += Math.min(dateCount * 3, 10);
  }

  // Ghost penalty: if there are gaps of 7+ days in the conversation
  const ghostCount = countGhosts(interactions);
  if (ghostCount >= 3) {
    score -= 10;
  } else if (ghostCount >= 1) {
    score -= 5;
  }

  // Clamp
  return Math.max(0, Math.min(100, score));
}

export function getDaysSinceLastInteraction(
  interactions: Interaction[]
): number {
  if (interactions.length === 0) return -1;
  const sorted = [...interactions].sort(
    (a, b) =>
      new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()
  );
  const now = new Date();
  const lastDate = new Date(sorted[0].logged_at);
  return Math.floor(
    (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
  );
}

export function getLastDirection(
  interactions: Interaction[]
): "sent" | "received" | null {
  if (interactions.length === 0) return null;
  const sorted = [...interactions].sort(
    (a, b) =>
      new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()
  );
  return sorted[0].direction;
}

// Count how many times there was a 7+ day gap in the conversation
export function countGhosts(interactions: Interaction[]): number {
  if (interactions.length < 2) return 0;

  const sorted = [...interactions].sort(
    (a, b) =>
      new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime()
  );

  let ghosts = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap =
      new Date(sorted[i].logged_at).getTime() -
      new Date(sorted[i - 1].logged_at).getTime();
    if (gap >= 7 * 24 * 60 * 60 * 1000) {
      ghosts++;
    }
  }
  return ghosts;
}

// Count dates/meetups/hangouts
export function countDates(interactions: Interaction[]): number {
  return interactions.filter(
    (i) =>
      i.interaction_type === "date" ||
      i.interaction_type === "hangout" ||
      i.interaction_type === "meetup"
  ).length;
}

// Get response time stats
export function getResponseStats(interactions: Interaction[]): {
  avgResponseHours: number | null;
  yourAvgHours: number | null;
  theirAvgHours: number | null;
} {
  if (interactions.length < 2)
    return {
      avgResponseHours: null,
      yourAvgHours: null,
      theirAvgHours: null,
    };

  const sorted = [...interactions].sort(
    (a, b) =>
      new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime()
  );

  const yourTimes: number[] = [];
  const theirTimes: number[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (prev.direction !== curr.direction) {
      const hours =
        (new Date(curr.logged_at).getTime() -
          new Date(prev.logged_at).getTime()) /
        (1000 * 60 * 60);
      if (hours < 168) {
        // ignore gaps > 7 days (not real responses)
        if (curr.direction === "sent") {
          yourTimes.push(hours);
        } else {
          theirTimes.push(hours);
        }
      }
    }
  }

  const avg = (arr: number[]) =>
    arr.length > 0
      ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10
      : null;

  const allTimes = [...yourTimes, ...theirTimes];

  return {
    avgResponseHours: avg(allTimes),
    yourAvgHours: avg(yourTimes),
    theirAvgHours: avg(theirTimes),
  };
}

// Conversation momentum — is it growing, stable, or dying
export function getMomentum(
  interactions: Interaction[]
): "rising" | "stable" | "declining" | "dead" | "new" {
  if (interactions.length < 3) return "new";

  const now = new Date();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

  const recent = interactions.filter(
    (i) => new Date(i.logged_at) >= twoWeeksAgo
  ).length;
  const older = interactions.filter(
    (i) =>
      new Date(i.logged_at) >= fourWeeksAgo &&
      new Date(i.logged_at) < twoWeeksAgo
  ).length;

  if (recent === 0 && older === 0) return "dead";
  if (recent === 0) return "dead";
  if (older === 0) return recent > 0 ? "rising" : "new";

  const change = (recent - older) / Math.max(older, 1);

  if (change > 0.3) return "rising";
  if (change < -0.3) return "declining";
  return "stable";
}
