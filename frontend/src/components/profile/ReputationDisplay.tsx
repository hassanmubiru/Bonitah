'use client';

import { type Address } from 'viem';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Trophy, Star, Award, Target } from 'lucide-react';

export interface ReputationData {
  score: bigint;
  level: string;
  nextLevelThreshold: bigint;
  achievements: Achievement[];
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  earnedAt: string;
  category: 'education' | 'savings' | 'community' | 'investment';
}

export interface ReputationDisplayProps {
  reputation: ReputationData | null;
  userAddress: Address;
}

/**
 * Displays user reputation score and achievement history.
 * Shows visual progress indicators and community standing.
 */
export function ReputationDisplay({ reputation }: ReputationDisplayProps) {
  if (!reputation) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Reputation & Achievements</CardTitle>
          <CardDescription>
            Track your community standing and earned achievements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <p className="text-muted-foreground">
              Register to start building your reputation
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const score = Number(reputation.score);
  const nextThreshold = Number(reputation.nextLevelThreshold);
  const progress = nextThreshold > 0 ? (score / nextThreshold) * 100 : 0;

  const getScoreColor = (score: number) => {
    if (score >= 1000) return 'text-purple-600 dark:text-purple-400';
    if (score >= 500) return 'text-blue-600 dark:text-blue-400';
    if (score >= 100) return 'text-green-600 dark:text-green-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  const getLevelBadge = (level: string) => {
    const levelColors: Record<string, string> = {
      'Newcomer': 'secondary',
      'Member': 'outline',
      'Trusted': 'default',
      'Expert': 'default',
      'Leader': 'default',
    };
    return levelColors[level] || 'secondary';
  };

  const getCategoryIcon = (category: Achievement['category']) => {
    switch (category) {
      case 'education': return <Award className="h-4 w-4" />;
      case 'savings': return <Target className="h-4 w-4" />;
      case 'community': return <Star className="h-4 w-4" />;
      case 'investment': return <Trophy className="h-4 w-4" />;
      default: return <Award className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: Achievement['category']) => {
    switch (category) {
      case 'education': return 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300';
      case 'savings': return 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300';
      case 'community': return 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300';
      case 'investment': return 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300';
      default: return 'bg-gray-50 text-gray-700 dark:bg-gray-950 dark:text-gray-300';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Reputation & Achievements
        </CardTitle>
        <CardDescription>
          Your community standing and earned achievements
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Reputation Score */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className={`text-3xl font-bold ${getScoreColor(score)}`}>
              {score.toLocaleString()}
            </span>
            <Badge variant={getLevelBadge(reputation.level) as any}>
              {reputation.level}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Reputation Points
          </p>

          {/* Progress to Next Level */}
          {nextThreshold > score && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress to next level</span>
                <span className="text-muted-foreground">
                  {score} / {nextThreshold.toLocaleString()}
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </div>

        {/* Achievements */}
        <div>
          <h4 className="font-medium mb-3">Recent Achievements</h4>
          {reputation.achievements.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No achievements yet. Start participating to earn your first achievements!
            </p>
          ) : (
            <div className="space-y-3">
              {reputation.achievements.slice(0, 5).map((achievement) => (
                <div
                  key={achievement.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30"
                >
                  <div className={`p-2 rounded-full ${getCategoryColor(achievement.category)}`}>
                    {getCategoryIcon(achievement.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm">{achievement.name}</p>
                      <Badge variant="outline" className="text-xs">
                        {achievement.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {achievement.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Earned {new Date(achievement.earnedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              ))}
              
              {reputation.achievements.length > 5 && (
                <div className="text-center">
                  <Badge variant="outline" className="text-xs">
                    +{reputation.achievements.length - 5} more achievements
                  </Badge>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Reputation Categories */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 rounded-lg border">
            <Award className="h-5 w-5 mx-auto mb-2 text-blue-500" />
            <p className="text-sm font-medium">Education</p>
            <p className="text-xs text-muted-foreground">
              {reputation.achievements.filter(a => a.category === 'education').length} achievements
            </p>
          </div>
          <div className="text-center p-3 rounded-lg border">
            <Target className="h-5 w-5 mx-auto mb-2 text-green-500" />
            <p className="text-sm font-medium">Savings</p>
            <p className="text-xs text-muted-foreground">
              {reputation.achievements.filter(a => a.category === 'savings').length} achievements
            </p>
          </div>
          <div className="text-center p-3 rounded-lg border">
            <Star className="h-5 w-5 mx-auto mb-2 text-purple-500" />
            <p className="text-sm font-medium">Community</p>
            <p className="text-xs text-muted-foreground">
              {reputation.achievements.filter(a => a.category === 'community').length} achievements
            </p>
          </div>
          <div className="text-center p-3 rounded-lg border">
            <Trophy className="h-5 w-5 mx-auto mb-2 text-orange-500" />
            <p className="text-sm font-medium">Investment</p>
            <p className="text-xs text-muted-foreground">
              {reputation.achievements.filter(a => a.category === 'investment').length} achievements
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}