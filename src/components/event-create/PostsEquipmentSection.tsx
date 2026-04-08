import React from 'react';
import { Checkbox, Chip, ScrollShadow, Select, SelectItem } from '@heroui/react';
import type { Event, Post, Venue, EventEquipment } from '@/app/types';

type FlattenedPost = {
  post: Post;
  layerName: string;
};

type Props = {
  hasVenue: boolean;
  postsEnabled: boolean;
  setPostsEnabled: (value: boolean) => void;
  flattenedPosts: FlattenedPost[];
  allPosts: Post[];
  getPostName: (post: Post) => string;
  eventData: Partial<Event> & { venue: Venue; eventEquipment: EventEquipment[] };
  setEventData: React.Dispatch<React.SetStateAction<Partial<Event> & { venue: Venue; eventEquipment: EventEquipment[] }>>;
  lastSelectedPostIndex: number | null;
  setLastSelectedPostIndex: React.Dispatch<React.SetStateAction<number | null>>;
  selectClassNames: {
    label: string;
    input: string;
    inputWrapper: string;
  };
};

export function PostsSelectionSection({
  hasVenue,
  postsEnabled,
  setPostsEnabled,
  flattenedPosts,
  allPosts,
  getPostName,
  eventData,
  setEventData,
  lastSelectedPostIndex,
  setLastSelectedPostIndex,
  selectClassNames,
}: Props) {
  if (!hasVenue) return null;

  return (
    <>
      <div className="flex-shrink-0 px-3 py-3 flex items-center justify-between">
        <h3 className="text-white font-semibold text-lg">Posts</h3>
        <Checkbox isSelected={postsEnabled} onValueChange={setPostsEnabled} size="sm">
          <span className="text-sm text-white">Enable Posts</span>
        </Checkbox>
      </div>

      <div className="space-y-3">
        <div className={`space-y-3 ${!postsEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
          <Select
            label="Select Posts"
            labelPlacement="outside"
            placeholder="Choose posts for this event"
            selectionMode="multiple"
            selectedKeys={new Set((eventData.eventPosts || []).map((post) => getPostName(post)))}
            isDisabled={!postsEnabled}
            classNames={selectClassNames}
            size="lg"
            disabledKeys={[]}
          >
            {flattenedPosts.map(({ post, layerName }, idx) => {
              const postName = getPostName(post);
              return (
                <SelectItem
                  key={postName}
                  textValue={postName}
                  onClick={(e: React.MouseEvent) => {
                    const me = e as React.MouseEvent;
                    me.preventDefault();
                    me.stopPropagation();

                    if (me.shiftKey && lastSelectedPostIndex !== null) {
                      const start = Math.min(lastSelectedPostIndex, idx);
                      const end = Math.max(lastSelectedPostIndex, idx);
                      const namesInRange = flattenedPosts.slice(start, end + 1).map((fp) => getPostName(fp.post));
                      const uniqueNames = Array.from(new Set([...(eventData.eventPosts || []).map((p) => getPostName(p)), ...namesInRange]));
                      const newPosts = uniqueNames
                        .map((name) => allPosts.find((p) => getPostName(p) === name))
                        .filter((postValue): postValue is Post => Boolean(postValue));
                      setEventData((prev) => ({ ...prev, eventPosts: newPosts }));
                      setLastSelectedPostIndex(idx);
                      return;
                    }

                    const selectedSet = new Set((eventData.eventPosts || []).map((p) => getPostName(p)));

                    if (me.ctrlKey || me.metaKey) {
                      if (selectedSet.has(postName)) selectedSet.delete(postName);
                      else selectedSet.add(postName);
                      const newPosts = Array.from(selectedSet)
                        .map((name) => allPosts.find((p) => getPostName(p) === name))
                        .filter((postValue): postValue is Post => Boolean(postValue));
                      setEventData((prev) => ({ ...prev, eventPosts: newPosts }));
                      setLastSelectedPostIndex(idx);
                      return;
                    }

                    if (selectedSet.has(postName)) selectedSet.delete(postName);
                    else selectedSet.add(postName);
                    const newPosts = Array.from(selectedSet)
                      .map((name) => allPosts.find((p) => getPostName(p) === name))
                      .filter((postValue): postValue is Post => Boolean(postValue));
                    setEventData((prev) => ({ ...prev, eventPosts: newPosts }));
                    setLastSelectedPostIndex(idx);
                  }}
                >
                  {postName} ({layerName})
                </SelectItem>
              );
            })}
          </Select>

          {(eventData.eventPosts || []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {(eventData.eventPosts || []).map((post, idx) => {
                const postName = getPostName(post);
                return (
                  <Chip
                    key={idx}
                    onClose={() => {
                      setEventData((prev) => ({
                        ...prev,
                        eventPosts: (prev.eventPosts || []).filter((_, i) => i !== idx),
                      }));
                    }}
                    variant="flat"
                    style={{ backgroundColor: '#3eb1fd33', color: '#3eb1fd' }}
                  >
                    {postName}
                  </Chip>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export function EquipmentSelectionSection({
  hasVenue,
  eventData,
  setEventData,
  selectClassNames,
  allPosts,
  getPostName,
}: Pick<Props, 'hasVenue' | 'eventData' | 'setEventData' | 'selectClassNames' | 'allPosts' | 'getPostName'>) {
  return (
    <div className="flex-1 px-4 py-3">
      {hasVenue && (
        <ScrollShadow className="space-y-2 pr-2 scrollbar-hide" hideScrollBar style={{ minHeight: 'calc(100vh - 334px)', maxHeight: 'calc(100vh - 334px)', overflow: 'auto' }}>
          {eventData.venue?.equipment?.map((equip) => {
            const selectedEquip = eventData.eventEquipment.find((e) => e.id === equip.id);
            const isSelected = !!selectedEquip;
            return (
              <div key={equip.id} className="rounded-2xl p-3" style={{ backgroundColor: '#27272a' }}>
                <div className="flex items-center gap-3">
                  <Checkbox
                    isSelected={isSelected}
                    onValueChange={(checked) => {
                      if (checked) {
                        setEventData((prev) => ({
                          ...prev,
                          eventEquipment: [...prev.eventEquipment, { ...equip, defaultLocation: undefined }],
                        }));
                      } else {
                        setEventData((prev) => ({
                          ...prev,
                          eventEquipment: prev.eventEquipment.filter((e) => e.id !== equip.id),
                        }));
                      }
                    }}
                  />
                  <span className="text-white font-medium flex-shrink-0">{equip.name}</span>
                  {isSelected && (
                    <Select
                      placeholder="Select Default Location"
                      selectedKeys={selectedEquip?.defaultLocation ? [selectedEquip.defaultLocation] : []}
                      onSelectionChange={(keys) => {
                        const locName = Array.from(keys)[0] as string;
                        setEventData((prev) => ({
                          ...prev,
                          eventEquipment: prev.eventEquipment.map((e) =>
                            e.id === equip.id ? { ...e, defaultLocation: locName } : e
                          ),
                        }));
                      }}
                      classNames={{
                        ...selectClassNames,
                        base: 'max-w-[200px]',
                      }}
                      size="sm"
                      className="ml-auto"
                    >
                      {allPosts.map((post) => {
                        const postName = getPostName(post);
                        return <SelectItem key={postName}>{postName}</SelectItem>;
                      })}
                    </Select>
                  )}
                </div>
              </div>
            );
          })}
        </ScrollShadow>
      )}
    </div>
  );
}
