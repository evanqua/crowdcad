'use client';

import { useRouter } from 'next/navigation';
import React, { useEffect, useState, useMemo } from 'react';
import { db } from '@/app/firebase';
import { collection, getDocs, query, where, deleteDoc, doc, addDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import type { Venue, Event } from '@/app/types';
import { useAuth } from '@/hooks/useauth';
import LoadingScreen from '@/components/ui/loading-screen';
import { DiagonalStreaksFixed } from "@/components/ui/diagonal-streaks-fixed";
import { stripUndefined } from '@/lib/utils';
import ShareModal from '@/components/modals/sharemodal';
import { Share2 } from "lucide-react";
import { 
  Card, 
  CardBody, 
  Button, 
  Dropdown, 
  DropdownTrigger, 
  DropdownMenu, 
  DropdownItem,
  Input,
  Chip,
  ScrollShadow
} from "@heroui/react";
import { 
  Plus, 
  MapPin, 
  Calendar, 
  Users, 
  Phone, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Play,
  Search,
  ChevronLeft
} from "lucide-react";

export default function VenueSelection() {
  const router = useRouter();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [, setLoading] = useState(true);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [recentEvents, setRecentEvents] = useState<Event[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [ownedVenuesList, setOwnedVenuesList] = useState<Venue[]>([]);
  const [sharedVenuesList, setSharedVenuesList] = useState<Venue[]>([]);
  const [ownedEventsList, setOwnedEventsList] = useState<Event[]>([]);
  const [sharedEventsList, setSharedEventsList] = useState<Event[]>([]);
  const { user, ready } = useAuth();
  const [shareModalData, setShareModalData] = useState<{
    id: string;
    name: string;
    type: 'venues' | 'events';
    sharedWith: string[];
  } | null>(null);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // const isEventIncomplete = (data: Partial<Event>) => {
  //   if (!data.name || data.name.trim() === '') {
  //     if (data.createdAt) {
  //       const createdTime = new Date(data.createdAt).getTime();
  //       const now = Date.now();
  //       return (now - createdTime) > 5 * 60 * 1000;
  //     }
  //     return true;
  //   }
  //   return false;
  // };

  const handleDeleteEvent = async (eventId: string) => {
    const confirm = window.confirm('Are you sure you want to delete this event?');
    if (!confirm) return;
    try {
      await deleteDoc(doc(db, 'events', eventId));
      setRecentEvents(prev => prev.filter(e => e.id !== eventId));
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Failed to delete event.');
    }
  };

  const handleDeleteVenue = async (venueId: string) => {
    const confirm = window.confirm('Are you sure you want to delete this venue?');
    if (!confirm) return;
    try {
      await deleteDoc(doc(db, 'venues', venueId));
      setVenues(prev => prev.filter(v => v.id !== venueId));
      if (selectedVenueId === venueId) {
        setSelectedVenueId(null);
      }
    } catch (error) {
      console.error('Error deleting venue:', error);
      alert('Failed to delete venue.');
    }
  };

  const handleStartNewEvent = async (venueId: string) => {
    const selectedVenue = venues.find((v) => v.id === venueId);
    if (!selectedVenue) {
      alert('Venue not found.');
      return;
    }

    try {
      const newEvent = {
        name: '',
        date: new Date(),
        venue: selectedVenue,
        postingTimes: [],
        staff: [],
        supervisor: [],
        userId: selectedVenue.userId,
        calls: [],
        eventPosts: [],
        eventEquipment: [],
        status: 'draft',
        createdAt: new Date().toISOString(),
      };

      const eventRef = await addDoc(collection(db, 'events'), stripUndefined(newEvent));
      router.push(`/events/${eventRef.id}/create`);
    } catch (error) {
      console.error('Error creating event:', error);
      alert('Failed to create event.');
    }
  };

  useEffect(() => {
    if (!user) {
      setVenues([]);
      setRecentEvents([]);
      setLoading(false);
      return;
    }

    const listeners: Unsubscribe[] = [];
    setLoading(true);

    // 1. Owned Venues Listener
    const ownedVenuesQuery = query(collection(db, 'venues'), where('userId', '==', user.uid));
    listeners.push(onSnapshot(ownedVenuesQuery, (snapshot) => {
      setOwnedVenuesList(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Venue)));
    }));

    // 2. Shared Venues Listener
    if (user.email) {
      const sharedVenuesQuery = query(collection(db, 'venues'), where('sharedWith', 'array-contains', user.email));
      listeners.push(onSnapshot(sharedVenuesQuery, (snapshot) => {
        setSharedVenuesList(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Venue)));
      }));
    } else {
      setSharedVenuesList([]);
    }

    // 3. Owned Events Listener
    const ownedEventsQuery = query(collection(db, 'events'), where('userId', '==', user.uid));
    listeners.push(onSnapshot(ownedEventsQuery, (snapshot) => {
      setOwnedEventsList(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Event)));
    }));

    // 4. Shared Events Listener
    if (user.email) {
      const sharedEventsQuery = query(collection(db, 'events'), where('sharedWith', 'array-contains', user.email));
      listeners.push(onSnapshot(sharedEventsQuery, (snapshot) => {
        setSharedEventsList(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Event)));
      }));
    } else {
      setSharedEventsList([]);
    }

    // Cleanup incomplete drafts (One-time check on mount/user load)
    const cleanupIncompleteEvents = async () => {
      try {
        const draftsQuery = query(
          collection(db, 'events'), 
          where('userId', '==', user.uid),
          where('status', '==', 'draft')
        );
        const draftsSnapshot = await getDocs(draftsQuery);
        const deletePromises = draftsSnapshot.docs
          .filter(doc => {
            const data = doc.data() as Partial<Event>;
            // Reuse your existing isEventIncomplete function
            if (!data.name || data.name.trim() === '') {
              if (data.createdAt) {
                const createdTime = new Date(data.createdAt).getTime();
                const now = Date.now();
                return (now - createdTime) > 5 * 60 * 1000;
              }
              return true;
            }
            return false;
          })
          .map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
      } catch (error) {
        console.error('Error cleaning up incomplete events:', error);
      }
    };
    cleanupIncompleteEvents();

    setLoading(false);

    return () => {
      listeners.forEach(unsub => unsub());
    };
  }, [user]);

  // NEW: Aggregation Effect to combine lists
  useEffect(() => {
    // Combine Venues
    const venueMap = new Map<string, Venue>();
    
    // Add owned and shared venues to map
    [...ownedVenuesList, ...sharedVenuesList].forEach(v => {
      venueMap.set(v.id, v);
    });

    // Process Events
    const rawEvents = [...ownedEventsList, ...sharedEventsList];
    const processedEvents = rawEvents.map(event => {
      // Ensure shared events contribute their venues to the venue list
      if (event.venue && !venueMap.has(event.venue.id)) {
        venueMap.set(event.venue.id, event.venue);
      }

      let dateStr: string;
      if (typeof event.date === 'string') {
        const d = new Date(event.date);
        dateStr = isNaN(d.getTime()) ? '' : d.toISOString();
      } else {
        dateStr = '';
      }
      return {
        ...event,
        date: dateStr,
      } as Event;
    });

    // Remove duplicates in event list if any (e.g. if user is both owner and in sharedWith)
    const uniqueEvents = Array.from(new Map(processedEvents.map(item => [item.id, item])).values());

    setVenues(Array.from(venueMap.values()));
    setRecentEvents(uniqueEvents);
  }, [ownedVenuesList, sharedVenuesList, ownedEventsList, sharedEventsList]);

  const venueStats = useMemo(() => {
    const byVenue: Record<string, { count: number; lastUsed: number | null }> = {};

    for (const v of venues) {
      byVenue[v.id] = { count: 0, lastUsed: null };
    }

    for (const e of recentEvents) {
      const vId = e.venue?.id;
      if (!vId || !byVenue[vId]) continue;

      byVenue[vId].count += 1;

      const ts = new Date(e.date as unknown as string).getTime();
      if (!Number.isNaN(ts)) {
        const prev = byVenue[vId].lastUsed ?? -Infinity;
        byVenue[vId].lastUsed = Math.max(prev, ts);
      }
    }

    const sorted = [...venues].sort((a, b) => {
      const aLast = byVenue[a.id]?.lastUsed ?? -Infinity;
      const bLast = byVenue[b.id]?.lastUsed ?? -Infinity;
      return bLast - aLast;
    });

    return { byVenue, sorted };
  }, [venues, recentEvents]);

  const filteredVenues = useMemo(() => {
    if (!searchQuery) return venueStats.sorted;
    return venueStats.sorted.filter(v => 
      v.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [venueStats.sorted, searchQuery]);

  const selectedVenueEvents = useMemo(() => {
    if (!selectedVenueId) return [];
    return recentEvents
      .filter(e => e.venue?.id === selectedVenueId)
      .sort((a, b) => {
        const ta = new Date(a.date).getTime() || 0;
        const tb = new Date(b.date).getTime() || 0;
        return tb - ta;
      });
  }, [selectedVenueId, recentEvents]);

  const formatRelativeDate = (timestamp: number | null) => {
    if (!timestamp) return 'Never used';
    const now = Date.now();
    const diff = now - timestamp;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Used today';
    if (days === 1) return 'Used yesterday';
    if (days < 7) return `Used ${days} days ago`;
    if (days < 14) return `Used ${Math.floor(days / 7)} week ago`;
    if (days < 30) return `Used ${Math.floor(days / 7)} weeks ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  // Authentication check
  useEffect(() => {
    if (ready && !user) {
      sessionStorage.setItem('redirectPath', '/venues/selection');
      router.push('/?login=true&error=auth');
    }
  }, [user, ready, router]);

  // Return early if auth is not ready or user is not authenticated
  if (!ready) {
    return <LoadingScreen label="Loading…" />;
  }

  if (!user) {
    return (
      <div className="bg-surface-deepest text-white min-h-screen pt-24 px-6 flex items-center justify-center">
        <div>Redirecting...</div>
      </div>
    );
  }

  // Mobile View - Show venue list or event details
  if (isMobile) {
    return (
      <main className="relative bg-surface-deepest text-white h-[calc(100vh-4rem)]">
        <DiagonalStreaksFixed />
        
        <div className="relative z-10 pt-10 px-4 pb-8">
          {/* Mobile: Venue List View */}
          {!selectedVenueId && (
            <>
              <div className="mb-6">
                <h1 className="text-3xl font-bold mb-2">Your Venues</h1>
                <p className="text-surface-light">Select a venue to view events or start a new one</p>
              </div>

              <Input
                placeholder="Search venues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                startContent={<Search className="w-4 h-4 text-surface-light" />}
                classNames={{
                  base: "mb-4",
                  inputWrapper: "bg-surface-deep border border-default",
                  input: "outline-none focus:outline-none data-[focus=true]:outline-none"
                }}
              />

              <ScrollShadow className="space-y-3 hideScrollBar">
                {filteredVenues.map((venue) => {
                  const stats = venueStats.byVenue[venue.id];
                  return (
                    <Card 
                      key={venue.id}
                      isPressable
                      onPress={() => setSelectedVenueId(venue.id)}
                      classNames={{
                        base: "bg-surface-deep/50 backdrop-blur-sm border border-1 w-full"
                      }}
                    >
                      <CardBody className="p-4">
                        <div className="flex justify-between items-start w-full">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <MapPin className="w-4 h-4 text-status-blue flex-shrink-0" />
                              <h3 className="font-semibold text-lg truncate">{venue.name}</h3>
                            </div>
                            <div className="text-sm text-surface-light">
                              {stats.count} {stats.count === 1 ? 'event' : 'events'}
                            </div>
                            <div className="text-xs text-surface-light mt-1">
                              {formatRelativeDate(stats.lastUsed)}
                            </div>
                          </div>
                          
                          <div
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <Dropdown placement="bottom-end" offset={6}>
                              <DropdownTrigger>
                                <button
                                  className="p-0 m-0 border-0 bg-transparent text-surface-light hover:text-status-blue transition-colors cursor-pointer flex items-center justify-center"
                                  aria-label="Venue actions"
                                  type="button"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                              </DropdownTrigger>
                              <DropdownMenu aria-label="Venue actions">
                                <DropdownItem 
                                  key="edit"
                                  startContent={<Edit className="w-4 h-4" />}
                                  onPress={() => router.push(`/venues/management?venueId=${venue.id}`)}
                                >
                                  Edit
                                </DropdownItem>
                                <DropdownItem 
                                  key="share"
                                  startContent={<Share2 className="w-4 h-4" />}
                                  onPress={() => setShareModalData({
                                    id: venue.id,
                                    name: venue.name,
                                    type: 'venues',
                                    sharedWith: venue.sharedWith || []
                                  })}
                                >
                                  Share
                                </DropdownItem>
                                <DropdownItem 
                                  key="delete"
                                  className="text-danger"
                                  color="danger"
                                  startContent={<Trash2 className="w-4 h-4" />}
                                  onPress={() => handleDeleteVenue(venue.id)}
                                >
                                  Delete
                                </DropdownItem>
                              </DropdownMenu>
                            </Dropdown>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  );
                })}
              </ScrollShadow>

              <Button
                size="lg"
                startContent={<Plus className="w-5 h-5" />}
                className="bg-accent hover:bg-accent/90 fixed bottom-6 right-6 shadow-lg z-50"
                onPress={() => router.push('/venues/management')}
              >
                New Venue
              </Button>
            </>
          )}

          {/* Mobile: Event Details View */}
          {selectedVenueId && (
            <>
              <Button
                variant="flat"
                startContent={<ChevronLeft className="w-4 h-4" />}
                onPress={() => setSelectedVenueId(null)}
                className="mb-4 text-md"
              >
                Back to Venues
              </Button>

              <div className="mb-6">
                <h1 className="text-2xl font-bold mb-2">
                  {venues.find(v => v.id === selectedVenueId)?.name}
                </h1>
                <Button
                  size="lg"
                  startContent={<Play className="w-5 h-5" />}
                  className="w-full bg-accent hover:bg-accent/90 text-white"
                  onPress={() => handleStartNewEvent(selectedVenueId)}
                >
                  Start New Event
                </Button>
              </div>

              <h2 className="text-lg font-semibold mb-3">Recent Events</h2>
              
              {selectedVenueEvents.length === 0 ? (
                <Card classNames={{ base: "bg-surface-deep/50 border border-default w-full" }}>
                  <CardBody className="text-center py-8 text-surface-light">
                    No events yet. Start your first event at this venue!
                  </CardBody>
                </Card>
              ) : (
                <div className="space-y-3">
                  {selectedVenueEvents.map((event) => (
                    <Card 
                      key={event.id}
                      isPressable
                      onPress={() => router.push(`/events/${event.id}/dispatch`)}
                      classNames={{
                        base: "bg-surface-deep/50 backdrop-blur-sm border border-default w-full"
                      }}
                    >
                      <CardBody className="p-4">
                        <div className="flex justify-between items-start w-full">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-lg mb-2 truncate">{event.name || 'Untitled Event'}</h3>
                            
                            <div className="space-y-1 text-sm text-surface-light">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                {new Date(event.date).toLocaleDateString()}
                              </div>
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                {event.staff?.length || 0} teams
                              </div>
                              <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4" />
                                {event.calls?.length || 0} calls
                              </div>
                            </div>

                            {event.status === 'draft' && (
                              <Chip size="sm" color="warning" className="mt-2">Draft</Chip>
                            )}
                          </div>
                          
                          <div
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <Dropdown placement="bottom-end" offset={6}>
                              <DropdownTrigger>
                                <button
                                  className="p-0 m-0 border-0 bg-transparent text-surface-light hover:text-status-blue transition-colors cursor-pointer flex items-center justify-center"
                                  aria-label="Event actions"
                                  type="button"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                              </DropdownTrigger>
                              <DropdownMenu aria-label="Event actions">
                                <DropdownItem 
                                  key="resume"
                                  startContent={<Play className="w-4 h-4" />}
                                  onPress={() => router.push(`/events/${event.id}/dispatch`)}
                                >
                                  Resume
                                </DropdownItem>
                                <DropdownItem 
                                  key="share"
                                  startContent={<Share2 className="w-4 h-4" />}
                                  onPress={() => setShareModalData({
                                    id: event.id,
                                    name: event.name || 'Untitled',
                                    type: 'events',
                                    sharedWith: event.sharedWith || []
                                  })}
                                >
                                  Share
                                </DropdownItem>
                                <DropdownItem 
                                  key="delete"
                                  className="text-danger"
                                  color="danger"
                                  startContent={<Trash2 className="w-4 h-4" />}
                                  onPress={() => handleDeleteEvent(event.id)}
                                >
                                  Delete
                                </DropdownItem>
                              </DropdownMenu>
                            </Dropdown>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modals */}
        {shareModalData && (
        <ShareModal
          isOpen={!!shareModalData}
          onClose={() => setShareModalData(null)}
          resourceId={shareModalData.id}
          resourceName={shareModalData.name}
          collectionName={shareModalData.type}
          currentSharedWith={
            shareModalData.type === 'venues'
              ? venues.find(v => v.id === shareModalData.id)?.sharedWith || []
              : recentEvents.find(e => e.id === shareModalData.id)?.sharedWith || []
          }
          onUpdate={() => {
          }}
        />
      )}
      </main>
    );
  }

  // Desktop View - Master-Detail Pattern
  return (
    <main className="relative bg-surface-deepest text-white h-[calc(100vh-4rem)]">
      <DiagonalStreaksFixed />
      
      <div className="relative z-10 pt-10 px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Venue Selection</h1>
            <p className="text-lg text-surface-light">
              Select a venue to view past events or start a new one
            </p>
          </div>

          <div className="flex gap-6 h-[calc(100vh-360px)]">
            {/* LEFT SIDEBAR - Venue List */}
            <div className="w-72 min-w-[200px] flex-shrink flex flex-col min-h-[calc(100vh-16rem)]">
              <div className="mb-4">
                <Button
                  size="lg"
                  startContent={<Plus className="w-5 h-5" />}
                  className="w-full bg-accent hover:bg-accent/90 text-white"
                  onPress={() => router.push('/venues/management')}
                >
                  New Venue
                </Button>
              </div>

              <Input
                placeholder="Search venues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                startContent={<Search className="w-4 h-4 text-surface-light" />}
                classNames={{
                  base: "mb-4",
                  inputWrapper: "bg-surface-deep border border-default",
                  input: "outline-none focus:outline-none data-[focus=true]:outline-none"
                }}
              />

              <ScrollShadow className="flex-1 space-y-2 scrollbar-hide">
                {filteredVenues.map((venue) => {
                  const stats = venueStats.byVenue[venue.id];
                  const isSelected = selectedVenueId === venue.id;
                  
                  return (
                    <Card 
                      key={venue.id}
                      classNames={{
                        base: `${isSelected 
                          ? 'bg-status-blue/20 border-status-blue' 
                          : 'bg-surface-deep/50 border-default'
                        } backdrop-blur-sm border-2 transition-all w-full`
                      }}
                    >
                      <div 
                        className="relative cursor-pointer"
                        onClick={() => setSelectedVenueId(venue.id)}
                      >
                        <CardBody className="pl-3 pr-1 relative">
                        <div className="pr-8">
                          <div className="flex items-center gap-2 mb-1">
                            <MapPin className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-status-blue' : 'text-surface-light'}`} />
                            <h3 className="font-semibold text-sm">{venue.name}</h3>
                          </div>
                          <div className="text-xs text-surface-light">
                            {stats.count} {stats.count === 1 ? 'event' : 'events'}
                          </div>
                          <div className="text-xs text-surface-light mt-1">
                            {formatRelativeDate(stats.lastUsed)}
                          </div>
                        </div>
                        </CardBody>
                        
                        <div 
                          className="absolute top-3 right-3 z-10"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Dropdown placement="bottom-end" offset={6}>
                            <DropdownTrigger>
                              <button
                                className="p-0 m-0 border-0 bg-transparent text-surface-light hover:text-status-blue transition-colors cursor-pointer flex items-center justify-center"
                                aria-label="Venue actions"
                                type="button"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </DropdownTrigger>
                            <DropdownMenu aria-label="Venue actions">
                              <DropdownItem 
                                key="edit"
                                startContent={<Edit className="w-4 h-4" />}
                                onPress={() => router.push(`/venues/management?venueId=${venue.id}`)}
                              >
                                Edit
                              </DropdownItem>
                              <DropdownItem 
                                key="share"
                                startContent={<Share2 className="w-4 h-4" />}
                                onPress={() => setShareModalData({
                                  id: venue.id,
                                  name: venue.name,
                                  type: 'venues',
                                  sharedWith: venue.sharedWith || []
                                })}
                              >
                                Share Venue
                              </DropdownItem>
                              <DropdownItem 
                                key="delete"
                                className="text-danger"
                                color="danger"
                                startContent={<Trash2 className="w-4 h-4" />}
                                onPress={() => handleDeleteVenue(venue.id)}
                              >
                                Delete
                              </DropdownItem>
                            </DropdownMenu>
                          </Dropdown>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </ScrollShadow>
            </div>

            {/* RIGHT PANEL - Event Table/Details */}
            <div className="flex-1 flex flex-col min-h-[calc(100vh-16rem)]">
              {!selectedVenueId ? (
                <Card classNames={{ base: "flex-1 bg-surface-deep/50 border border-default" }}>
                  <CardBody className="flex items-center justify-center">
                    <div className="text-center text-surface-light">
                      <MapPin className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p className="text-lg">Select a venue to view its events</p>
                      <p className="text-sm mt-2">or create a new venue to get started</p>
                    </div>
                  </CardBody>
                </Card>
              ) : (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold">
                        {venues.find(v => v.id === selectedVenueId)?.name}
                      </h2>
                      <p className="text-sm text-surface-light">
                        {selectedVenueEvents.length} {selectedVenueEvents.length === 1 ? 'event' : 'events'} recorded
                      </p>
                    </div>
                    <Button
                      size="lg"
                      startContent={<Play className="w-5 h-5" />}
                      className="bg-accent hover:bg-accent/90 text-white"
                      onPress={() => handleStartNewEvent(selectedVenueId)}
                    >
                      Start New Event
                    </Button>
                  </div>

                  <Card classNames={{ base: "flex-1 bg-surface-deep/50 border border-default overflow-hidden" }}>
                    <CardBody className="p-0">
                      {selectedVenueEvents.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-surface-light">
                          <div className="text-center">
                            <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
                            <p className="text-lg">No events yet</p>
                            <p className="text-sm mt-2">Start your first event at this venue!</p>
                          </div>
                        </div>
                      ) : (
                        <div className="overflow-auto h-full min-w-[500px]">
                          <table className="w-full">
                            <thead className="sticky top-0 bg-default border-b border-default">
                              <tr>
                                <th className="text-left p-4 font-semibold">Event Name</th>
                                <th className="text-left p-4 font-semibold">Date</th>
                                <th className="text-left p-4 font-semibold">Teams</th>
                                <th className="text-left p-4 font-semibold">Calls</th>
                                <th className="text-right p-4 font-semibold">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedVenueEvents.map((event) => (
                                <tr 
                                  key={event.id}
                                  className="border-b border-default hover:bg-surface-deeper/50 cursor-pointer transition-colors"
                                  onClick={() => router.push(`/events/${event.id}/dispatch`)}
                                >
                                  <td className="p-4">
                                    <div className="font-medium">{event.name || 'Untitled Event'}</div>
                                  </td>
                                  <td className="p-4 text-surface-light">
                                    <div className="flex items-center gap-2">
                                      <Calendar className="w-4 h-4" />
                                      {new Date(event.date).toLocaleDateString()}
                                    </div>
                                  </td>
                                  <td className="p-4 text-surface-light">
                                    <div className="flex items-center gap-2">
                                      <Users className="w-4 h-4" />
                                      {event.staff?.length || 0}
                                    </div>
                                  </td>
                                  <td className="p-4 text-surface-light">
                                    <div className="flex items-center gap-2">
                                      <Phone className="w-4 h-4" />
                                      {event.calls?.length || 0}
                                    </div>
                                  </td>
                                  <td className="p-4 text-right">
                                    <div
                                      onClick={(e) => e.stopPropagation()}
                                      onKeyDown={(e) => e.stopPropagation()}
                                    >
                                      <Dropdown placement="bottom-end" offset={6}>
                                        <DropdownTrigger>
                                          <button
                                            className="p-0 m-0 border-0 bg-transparent text-surface-light hover:text-status-blue transition-colors cursor-pointer flex items-center justify-center ml-auto"
                                            aria-label="Event actions"
                                            type="button"
                                          >
                                            <MoreVertical className="w-4 h-4" />
                                          </button>
                                        </DropdownTrigger>
                                        <DropdownMenu aria-label="Event actions">
                                          <DropdownItem 
                                            key="resume"
                                            startContent={<Play className="w-4 h-4" />}
                                            onPress={() => router.push(`/events/${event.id}/dispatch`)}
                                          >
                                            Resume Event
                                          </DropdownItem>
                                          <DropdownItem 
                                            key="share"
                                            startContent={<Share2 className="w-4 h-4" />}
                                            onPress={() => setShareModalData({
                                              id: event.id,
                                              name: event.name || 'Untitled',
                                              type: 'events',
                                              sharedWith: event.sharedWith || []
                                            })}
                                          >
                                            Share Event
                                          </DropdownItem>
                                          <DropdownItem 
                                            key="delete"
                                            className="text-danger"
                                            color="danger"
                                            startContent={<Trash2 className="w-4 h-4" />}
                                            onPress={() => handleDeleteEvent(event.id)}
                                          >
                                            Delete
                                          </DropdownItem>
                                        </DropdownMenu>
                                      </Dropdown>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardBody>
                  </Card>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {shareModalData && (
        <ShareModal
          isOpen={!!shareModalData}
          onClose={() => setShareModalData(null)}
          resourceId={shareModalData.id}
          resourceName={shareModalData.name}
          collectionName={shareModalData.type}
          currentSharedWith={
            shareModalData.type === 'venues'
              ? venues.find(v => v.id === shareModalData.id)?.sharedWith || []
              : recentEvents.find(e => e.id === shareModalData.id)?.sharedWith || []
          }
          onUpdate={() => {
          }}
        />
      )}
    </main>
  );
}
