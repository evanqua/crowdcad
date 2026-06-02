import { useState } from 'react';

export type TeamMemberDraft = { name: string; cert: string; lead: boolean };

type Options = {
  initialTeamName?: string;
  initialMembers?: TeamMemberDraft[];
};

export function useTeamForm(options: Options = {}) {
  const { initialTeamName = '', initialMembers = [] } = options;

  const [teamName, setTeamName] = useState(initialTeamName);
  const [memberName, setMemberName] = useState('');
  const [memberCert, setMemberCert] = useState('');
  const [isTeamLead, setIsTeamLead] = useState(false);
  const [currentMembers, setCurrentMembers] = useState<TeamMemberDraft[]>(initialMembers);

  const addMember = () => {
    if (!memberName.trim() || !memberCert) return;
    setCurrentMembers((current) => [
      ...current,
      {
        name: memberName.trim(),
        cert: memberCert,
        lead: isTeamLead,
      },
    ]);
    setMemberName('');
    setMemberCert('');
    setIsTeamLead(false);
  };

  const removeMember = (index: number) => {
    setCurrentMembers((current) => current.filter((_, idx) => idx !== index));
  };

  const reset = () => {
    setTeamName('');
    setMemberName('');
    setMemberCert('');
    setIsTeamLead(false);
    setCurrentMembers([]);
  };

  return {
    teamName,
    setTeamName,
    memberName,
    setMemberName,
    memberCert,
    setMemberCert,
    isTeamLead,
    setIsTeamLead,
    currentMembers,
    setCurrentMembers,
    addMember,
    removeMember,
    reset,
  };
}
