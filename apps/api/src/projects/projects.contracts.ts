export interface ProjectView {
  id: string;
  name: string;
  description: string | null;
  githubRepo: string | null;
  technologies: string[];
  createdAt: string;
  updatedAt: string;
}

export type ProjectError =
  | 'not-found'
  | 'name-taken'
  | 'plan-limit-reached'
  | 'forbidden';
