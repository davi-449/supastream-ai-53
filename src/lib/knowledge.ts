export type UUID = string;

export interface KnowledgeFile {
  id: UUID;
  filename: string;
  url?: string;
  uploadedAt: string; // ISO string
  owner?: string; // user id
  isGlobal: boolean;
}

export interface ProjectKnowledgeLink {
  projectId: UUID;
  knowledgeFileId: UUID;
}

export interface KnowledgeChecklist {
  accessChecked: boolean;
  searchPrepared: boolean;
  permissionFiltered: boolean;
  indexRefreshed: boolean;
}

export interface KnowledgeQueryResult {
  files: KnowledgeFile[];
  checklist: KnowledgeChecklist;
}

// Local persistence disabled. All data must be served by Supabase.
// Any attempt to use localStorage/sessionStorage will be blocked.

function disabledStorageAccess(): never {
  // Throw to ensure developers notice during runtime that local persistence is disabled
  throw new Error('Local storage persistence disabled. Use Supabase for all data operations.');
}

export const knowledge = {
  refreshIndex(): KnowledgeChecklist {
    // No-op: local indexes are not available. Upstream should query Supabase instead.
    return {
      accessChecked: false,
      searchPrepared: false,
      permissionFiltered: false,
      indexRefreshed: false,
    };
  },

  listAll(): KnowledgeFile[] {
    // Return empty — no local mocks allowed
    return [];
  },

  listForProject(projectId: UUID): KnowledgeFile[] {
    return [];
  },

  queryAccessible(projectId: UUID, _userId?: UUID): KnowledgeQueryResult {
    const checklist = this.refreshIndex();
    const files: KnowledgeFile[] = [];
    return { files, checklist };
  },

  addFile(): KnowledgeFile {
    return disabledStorageAccess();
  },

  removeFile(): never {
    return disabledStorageAccess();
  },

  setGlobal(): never {
    return disabledStorageAccess();
  },
};
