import { z } from "zod";

export const RepositoryEvent = z.object({
  id: z.string(),
  type: z.string(),
  repository: z.string(),
  data: z.object({}).passthrough(),
});
export type RepositoryEvent = z.infer<typeof RepositoryEvent>;

export type Repository = { owner: string; name: string };
export const parseRepository = (repo: string): Repository | undefined => {
  const [owner, name] = repo.split("/");
  if (owner === undefined || name === undefined) {
    return undefined;
  }
  return { owner, name };
};
