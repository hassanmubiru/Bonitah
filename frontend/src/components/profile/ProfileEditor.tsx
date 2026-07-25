'use client';

import { useState, useEffect } from 'react';
import { type Address } from 'viem';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Save, X, Plus } from 'lucide-react';
import { useProfileUpdate } from '@/hooks/useProfileUpdate';
import { type ProfileData, type IPFSProfileContent } from './ProfileInfo';

export interface ProfileEditorProps {
  userAddress: Address;
  profileData: ProfileData | null;
  onSave: () => void;
  onCancel: () => void;
}

/**
 * Profile editing interface with IPFS document upload.
 * Updates profile information with IPFS document upload functionality.
 */
export function ProfileEditor({ userAddress, profileData, onSave, onCancel }: ProfileEditorProps) {
  const [formData, setFormData] = useState<IPFSProfileContent>({
    name: '',
    bio: '',
    location: '',
    website: '',
    twitter: '',
    github: '',
    profession: '',
    skills: [],
  });
  const [newSkill, setNewSkill] = useState('');
  const { updateProfile, isUpdating, error } = useProfileUpdate();

  // Load existing profile data when component mounts
  useEffect(() => {
    // In a real implementation, this would load from IPFS using profileData.profileHash
    // For now, we'll start with empty form
  }, [profileData]);

  const handleInputChange = (field: keyof IPFSProfileContent, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const addSkill = () => {
    if (newSkill.trim() && !formData.skills?.includes(newSkill.trim())) {
      setFormData(prev => ({
        ...prev,
        skills: [...(prev.skills || []), newSkill.trim()],
      }));
      setNewSkill('');
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills?.filter(skill => skill !== skillToRemove) || [],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!profileData?.isRegistered) {
      alert('You must be registered to update your profile');
      return;
    }

    try {
      await updateProfile(formData);
      onSave();
    } catch (err) {
      console.error('Profile update failed:', err);
    }
  };

  const validateUrl = (url: string) => {
    if (!url) return true;
    try {
      new URL(url.startsWith('http') ? url : `https://${url}`);
      return true;
    } catch {
      return false;
    }
  };

  const normalizeUrl = (url: string) => {
    if (!url) return '';
    return url.startsWith('http') ? url : `https://${url}`;
  };

  const normalizeUsername = (username: string) => {
    return username.replace('@', '').replace(/^https?:\/\/(www\.)?(twitter\.com|github\.com)\//, '');
  };

  if (!profileData?.isRegistered) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <div>
              <p className="font-medium">Registration Required</p>
              <p className="text-sm">
                You must register on the Registry contract before creating a profile.
              </p>
            </div>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Profile</CardTitle>
        <CardDescription>
          Update your profile information stored on IPFS
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter your full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profession">Profession</Label>
              <Input
                id="profession"
                value={formData.profession}
                onChange={(e) => handleInputChange('profession', e.target.value)}
                placeholder="e.g., Software Developer, Financial Advisor"
              />
            </div>
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => handleInputChange('bio', e.target.value)}
              placeholder="Tell others about yourself, your experience, and interests..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Share your background, expertise, and what brings you to BFN
            </p>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => handleInputChange('location', e.target.value)}
              placeholder="e.g., Lagos, Nigeria"
            />
          </div>

          {/* Skills */}
          <div className="space-y-2">
            <Label>Skills & Expertise</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.skills?.map((skill) => (
                <Badge
                  key={skill}
                  variant="outline"
                  className="text-xs pr-1"
                >
                  {skill}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-1 h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => removeSkill(skill)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                placeholder="Add a skill"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
              />
              <Button type="button" variant="outline" size="sm" onClick={addSkill}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Social Links */}
          <div className="space-y-4">
            <Label>Social & Professional Links</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="website" className="text-sm">Website</Label>
                <Input
                  id="website"
                  value={formData.website}
                  onChange={(e) => handleInputChange('website', normalizeUrl(e.target.value))}
                  placeholder="https://yourwebsite.com"
                  className={!validateUrl(formData.website || '') ? 'border-destructive' : ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="twitter" className="text-sm">Twitter</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm">
                    @
                  </span>
                  <Input
                    id="twitter"
                    value={formData.twitter}
                    onChange={(e) => handleInputChange('twitter', normalizeUsername(e.target.value))}
                    placeholder="username"
                    className="pl-7"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="github" className="text-sm">GitHub</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm">
                    @
                  </span>
                  <Input
                    id="github"
                    value={formData.github}
                    onChange={(e) => handleInputChange('github', normalizeUsername(e.target.value))}
                    placeholder="username"
                    className="pl-7"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <div>
                <p className="font-medium">Update Failed</p>
                <p className="text-sm">{error.message}</p>
              </div>
            </Alert>
          )}

          {/* Form Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isUpdating}>
              Cancel
            </Button>
            <Button type="submit" disabled={isUpdating}>
              {isUpdating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Profile
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}