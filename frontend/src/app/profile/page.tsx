'use client';

import { useState } from 'react';
import { User, Shield, Award, Upload, Edit3, ExternalLink } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useRegistryProfile } from '@/hooks/useRegistryProfile';
import { useDocumentUpload } from '@/hooks/useDocumentUpload';

/**
 * Profile page - User profile management with Registry and IPFS integration.
 *
 * Implements Task 21.9 requirements:
 * - Profile, verification, and reputation from Registry + IPFS; profile-doc upload
 * - Requirements: 3.3, 3.5, 3.7, 11.7
 *
 * Features:
 * - Profile display and editing with Registry contract integration
 * - Document upload via IPFS service (<=10MB, PII exclusion)
 * - Verification status and reputation display
 * - Profile metadata management
 * - Real-time updates from blockchain state
 */
export default function ProfilePage() {
  const { isAuthenticated, isLoading: authLoading } = useAuthGuard();
  const {
    profile,
    reputation,
    isVerified,
    isLoading: profileLoading,
    updateProfile,
    error: profileError
  } = useRegistryProfile();
  
  const {
    uploadDocument,
    deleteDocument,
    isUploading,
    uploadProgress,
    error: uploadError
  } = useDocumentUpload();

  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    displayName: '',
    bio: '',
    website: '',
    twitter: '',
    github: '',
    location: ''
  });

  // Loading state
  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const handleProfileUpdate = async () => {
    try {
      await updateProfile(profileData);
      setIsEditing(false);
    } catch (error) {
      console.error('Profile update failed:', error);
    }
  };

  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        await uploadDocument(file, 'profile-document');
      } catch (error) {
        console.error('Document upload failed:', error);
      }
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2 mb-2">
          <User className="h-8 w-8" />
          Profile
        </h1>
        <p className="text-muted-foreground">
          Manage your BFN profile, verification status, and reputation.
        </p>
      </div>

      {/* Profile Overview Card */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div className="flex items-center space-x-4">
            <div className="h-20 w-20 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center">
              <User className="h-10 w-10 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">
                {profile?.displayName || 'Unnamed User'}
              </h2>
              <p className="text-muted-foreground">
                {profile?.walletAddress?.slice(0, 6)}...{profile?.walletAddress?.slice(-4)}
              </p>
              <div className="flex items-center gap-2 mt-2">
                {isVerified ? (
                  <Badge variant="default" className="bg-green-500">
                    <Shield className="h-3 w-3 mr-1" />
                    Verified
                  </Badge>
                ) : (
                  <Badge variant="outline">
                    <Shield className="h-3 w-3 mr-1" />
                    Unverified
                  </Badge>
                )}
                <Badge variant="secondary">
                  <Award className="h-3 w-3 mr-1" />
                  {reputation || 0} Rep
                </Badge>
              </div>
            </div>
          </div>
          <Button
            variant={isEditing ? "default" : "outline"}
            onClick={() => setIsEditing(!isEditing)}
            disabled={profileLoading}
          >
            <Edit3 className="h-4 w-4 mr-2" />
            {isEditing ? 'Save Changes' : 'Edit Profile'}
          </Button>
        </CardHeader>
        <CardContent>
          {profile?.bio && (
            <p className="text-sm text-muted-foreground mb-4">{profile.bio}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {profile?.website && (
              <Button variant="outline" size="sm" asChild>
                <a href={profile.website} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Website
                </a>
              </Button>
            )}
            {profile?.twitter && (
              <Button variant="outline" size="sm" asChild>
                <a href={`https://twitter.com/${profile.twitter}`} target="_blank" rel="noopener noreferrer">
                  Twitter
                </a>
              </Button>
            )}
            {profile?.github && (
              <Button variant="outline" size="sm" asChild>
                <a href={`https://github.com/${profile.github}`} target="_blank" rel="noopener noreferrer">
                  GitHub
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile">Profile Info</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="reputation">Reputation</TabsTrigger>
          <TabsTrigger value="verification">Verification</TabsTrigger>
        </TabsList>

        {/* Profile Information Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your profile information stored on IPFS and Registry.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {profileError && (
                <Alert variant="destructive">
                  <AlertDescription>{profileError}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={profileData.displayName}
                    onChange={(e) => setProfileData(prev => ({ ...prev, displayName: e.target.value }))}
                    disabled={!isEditing}
                    placeholder="Enter your display name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={profileData.location}
                    onChange={(e) => setProfileData(prev => ({ ...prev, location: e.target.value }))}
                    disabled={!isEditing}
                    placeholder="Your location"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    type="url"
                    value={profileData.website}
                    onChange={(e) => setProfileData(prev => ({ ...prev, website: e.target.value }))}
                    disabled={!isEditing}
                    placeholder="https://your-website.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="twitter">Twitter Handle</Label>
                  <Input
                    id="twitter"
                    value={profileData.twitter}
                    onChange={(e) => setProfileData(prev => ({ ...prev, twitter: e.target.value }))}
                    disabled={!isEditing}
                    placeholder="username"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="github">GitHub Username</Label>
                  <Input
                    id="github"
                    value={profileData.github}
                    onChange={(e) => setProfileData(prev => ({ ...prev, github: e.target.value }))}
                    disabled={!isEditing}
                    placeholder="username"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={profileData.bio}
                  onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
                  disabled={!isEditing}
                  placeholder="Tell us about yourself..."
                  rows={3}
                />
              </div>

              {isEditing && (
                <div className="flex gap-2 pt-4">
                  <Button onClick={handleProfileUpdate} disabled={profileLoading}>
                    {profileLoading ? 'Updating...' : 'Save Changes'}
                  </Button>
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Profile Documents</CardTitle>
              <CardDescription>
                Upload and manage documents stored on IPFS (max 10MB per file).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {uploadError && (
                <Alert variant="destructive">
                  <AlertDescription>{uploadError}</AlertDescription>
                </Alert>
              )}

              {/* Upload Section */}
              <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
                <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Drop files here or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supports PDF, images, and documents up to 10MB
                  </p>
                  <input
                    type="file"
                    onChange={handleDocumentUpload}
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    className="hidden"
                    id="document-upload"
                    disabled={isUploading}
                  />
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('document-upload')?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? 'Uploading...' : 'Select Files'}
                  </Button>
                </div>
                
                {isUploading && (
                  <div className="mt-4 space-y-2">
                    <Progress value={uploadProgress} className="w-full" />
                    <p className="text-sm text-muted-foreground">
                      Uploading... {uploadProgress}%
                    </p>
                  </div>
                )}
              </div>

              {/* Document List */}
              <div className="space-y-3">
                {profile?.documents?.map((doc: { id: string; name: string; url: string; size: string; uploadedAt: string }) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                        <ExternalLink className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium">{doc.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {doc.size} • Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(doc.url, '_blank')}
                      >
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteDocument(doc.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
                
                {(!profile?.documents || profile.documents.length === 0) && (
                  <p className="text-center text-muted-foreground py-8">
                    No documents uploaded yet.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reputation Tab */}
        <TabsContent value="reputation">
          <Card>
            <CardHeader>
              <CardTitle>Reputation Score</CardTitle>
              <CardDescription>
                Your reputation is earned through participation and achievements.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center space-y-4">
                <div className="text-4xl font-bold text-primary">
                  {reputation !== undefined ? Number(reputation) : '—'}
                </div>
                <p className="text-muted-foreground">Total Reputation Points</p>
                
                {reputation !== undefined && Number(reputation) > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                    <div className="text-center">
                      <div className="text-2xl font-semibold">{getReputationLevel(Number(reputation))}</div>
                      <p className="text-sm text-muted-foreground">Level</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-semibold">{getNextThreshold(Number(reputation))}</div>
                      <p className="text-sm text-muted-foreground">Next Level At</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-semibold">
                        {Math.min(100, Math.round((Number(reputation) / getNextThreshold(Number(reputation))) * 100))}%
                      </div>
                      <p className="text-sm text-muted-foreground">Progress</p>
                    </div>
                  </div>
                )}

                {(reputation === undefined || Number(reputation) === 0) && (
                  <div className="py-4">
                    <p className="text-sm text-muted-foreground">
                      Start participating to earn reputation points. Deposit savings, complete courses, and vote on proposals.
                    </p>
                  </div>
                )}
              </div>

              {/* How to Earn */}
              <div className="space-y-3">
                <h4 className="font-semibold">How to Earn Reputation</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Award className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">Savings Deposits</p>
                        <p className="text-sm text-muted-foreground">Deposit into SavingsVault</p>
                      </div>
                    </div>
                    <Badge variant="secondary">+10 Rep</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Award className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">Complete Courses</p>
                        <p className="text-sm text-muted-foreground">Finish education modules</p>
                      </div>
                    </div>
                    <Badge variant="secondary">+25 Rep</Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Award className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">Governance Voting</p>
                        <p className="text-sm text-muted-foreground">Vote on community proposals</p>
                      </div>
                    </div>
                    <Badge variant="secondary">+5 Rep</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Verification Tab */}
        <TabsContent value="verification">
          <Card>
            <CardHeader>
              <CardTitle>Account Verification</CardTitle>
              <CardDescription>
                Verify your account to increase trust and unlock additional features.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center space-x-4 p-4 border rounded-lg">
                <Shield className={`h-12 w-12 ${isVerified ? 'text-green-500' : 'text-muted-foreground'}`} />
                <div className="flex-1">
                  <h4 className="font-semibold">
                    {isVerified ? 'Verified Account' : 'Unverified Account'}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {isVerified 
                      ? 'Your account has been verified by the BFN team.'
                      : 'Complete verification to access advanced features.'
                    }
                  </p>
                </div>
                {isVerified ? (
                  <Badge variant="default" className="bg-green-500">Verified</Badge>
                ) : (
                  <Button>Start Verification</Button>
                )}
              </div>

              {!isVerified && (
                <div className="space-y-4">
                  <h4 className="font-semibold">Verification Requirements</h4>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className="h-2 w-2 bg-green-500 rounded-full" />
                      <span className="text-sm">Complete profile information</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="h-2 w-2 bg-muted rounded-full" />
                      <span className="text-sm text-muted-foreground">Upload identity documents</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="h-2 w-2 bg-muted rounded-full" />
                      <span className="text-sm text-muted-foreground">Minimum reputation score (100)</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}


function getReputationLevel(score: number): string {
  if (score >= 2000) return 'Leader';
  if (score >= 1000) return 'Expert';
  if (score >= 500) return 'Trusted';
  if (score >= 100) return 'Member';
  return 'Newcomer';
}

function getNextThreshold(score: number): number {
  if (score < 100) return 100;
  if (score < 500) return 500;
  if (score < 1000) return 1000;
  if (score < 2000) return 2000;
  return 5000;
}
