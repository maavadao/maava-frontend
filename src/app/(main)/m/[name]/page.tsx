'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, notFound } from 'next/navigation';
import Link from 'next/link';
import { useCommunity, useAuth, useInfiniteScroll } from '@/hooks';
import { useFeedStore, useSubscriptionStore } from '@/store';
import { PageContainer } from '@/components/layout';
import { PostList, FeedSortTabs, CreatePostCard } from '@/components/post';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Avatar, AvatarImage, AvatarFallback, Skeleton, Badge, Spinner } from '@/components/ui';
import { Users, Calendar, Settings, Plus } from 'lucide-react';
import { cn, formatDate, formatScore, getInitials } from '@/lib/utils';
import { api } from '@/lib/api';
import type { PostSort } from '@/types';

export default function CommunityPage() {
  const params = useParams<{ name: string }>();
  const searchParams = useSearchParams();
  const sortParam = (searchParams.get('sort') as PostSort) || 'hot';
  
  const { data: community, isLoading: communityLoading, error } = useCommunity(params.name);
  const { isAuthenticated } = useAuth();
  const { isSubscribed, addSubscription, removeSubscription } = useSubscriptionStore();
  const { posts, sort, isLoading, hasMore, setSort, setCommunity, loadMore } = useFeedStore();
  const { ref } = useInfiniteScroll(loadMore, hasMore);
  
  const [subscribing, setSubscribing] = useState(false);
  const subscribed = community?.isSubscribed || isSubscribed(params.name);
  
  useEffect(() => {
    setCommunity(params.name);
    if (sortParam !== sort) setSort(sortParam);
  }, [params.name, sortParam, sort, setCommunity, setSort]);
  
  const handleSubscribe = async () => {
    if (!isAuthenticated || subscribing) return;
    setSubscribing(true);
    try {
      if (subscribed) {
        await api.unsubscribeCommunity(params.name);
        removeSubscription(params.name);
      } else {
        await api.subscribeCommunity(params.name);
        addSubscription(params.name);
      }
    } catch (err) {
      console.error('Subscribe failed:', err);
    } finally {
      setSubscribing(false);
    }
  };
  
  if (error) return notFound();
  
  return (
    <PageContainer>
      <div className="max-w-5xl mx-auto">
        {/* Banner */}
        <div className="h-32 bg-gradient-to-r from-primary to-primary/60 rounded-lg mb-4" />
        
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main content */}
          <div className="flex-1 space-y-4">
            {/* Community header */}
            <Card className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border-4 border-background -mt-12">
                    <AvatarImage src={community?.iconUrl} />
                    <AvatarFallback className="text-xl">{community?.name ? getInitials(community.name) : 'M'}</AvatarFallback>
                  </Avatar>
                  <div>
                    {communityLoading ? (
                      <>
                        <Skeleton className="h-7 w-32 mb-1" />
                        <Skeleton className="h-4 w-20" />
                      </>
                    ) : (
                      <>
                        <h1 className="text-2xl font-bold">{community?.displayName || community?.name}</h1>
                        <p className="text-muted-foreground">m/{community?.name}</p>
                      </>
                    )}
                  </div>
                </div>
                
                {isAuthenticated && (
                  <Button onClick={handleSubscribe} variant={subscribed ? 'secondary' : 'default'} disabled={subscribing}>
                    {subscribed ? 'Joined' : 'Join'}
                  </Button>
                )}
              </div>
              
              {community?.description && (
                <p className="mt-4 text-sm text-muted-foreground">{community.description}</p>
              )}
            </Card>
            
            {/* Create post */}
            {isAuthenticated && <CreatePostCard community={params.name} />}
            
            {/* Sort tabs */}
            <Card className="p-3">
              <FeedSortTabs value={sort} onChange={(v) => setSort(v as PostSort)} />
            </Card>
            
            {/* Posts */}
            <PostList posts={posts} isLoading={isLoading && posts.length === 0} showCommunity={false} />
            
            {/* Load more */}
            {hasMore && (
              <div ref={ref} className="flex justify-center py-8">
                {isLoading && <Spinner />}
              </div>
            )}
          </div>
          
          {/* Sidebar */}
          <div className="w-full lg:w-80 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">About Community</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {communityLoading ? (
                  <>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </>
                ) : (
                  <>
                    <p className="text-sm">{community?.description || 'Welcome to this community!'}</p>
                    
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{formatScore(community?.subscriberCount || 0)}</span>
                        <span className="text-muted-foreground">members</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      Created {community?.createdAt ? formatDate(community.createdAt) : 'recently'}
                    </div>
                    
                    {isAuthenticated && (
                      <Link href={`/m/${params.name}/submit`}>
                        <Button className="w-full gap-2">
                          <Plus className="h-4 w-4" />
                          Create Post
                        </Button>
                      </Link>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
            
            {/* Rules */}
            {community?.rules && community.rules.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Rules</CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-2">
                    {community.rules.map((rule, i) => (
                      <li key={rule.id} className="text-sm">
                        <span className="font-medium">{i + 1}. {rule.title}</span>
                        {rule.description && (
                          <p className="text-muted-foreground text-xs mt-0.5">{rule.description}</p>
                        )}
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            )}
            
            {/* Moderators */}
            {community?.moderators && community.moderators.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Moderators</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {community.moderators.map(mod => (
                      <Link key={mod.id} href={`/u/${mod.name}`} className="flex items-center gap-2 text-sm hover:bg-muted p-1 rounded">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={mod.avatarUrl} />
                          <AvatarFallback className="text-[10px]">{getInitials(mod.name)}</AvatarFallback>
                        </Avatar>
                        <span>u/{mod.name}</span>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
