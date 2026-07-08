import { existsSync } from "node:fs";
import { join } from "node:path";
import { getCollection, type CollectionEntry } from "astro:content";
import { getSortedPosts } from "./getSortedPosts";

/** Posts whose markdown source file still exists on disk. */
export function isRenderablePost(
  post: CollectionEntry<"posts">
): boolean {
  if (!post.filePath || !post.body) return false;
  return existsSync(join(process.cwd(), post.filePath));
}

export async function getRenderablePosts() {
  const posts = await getCollection("posts");
  return posts.filter(isRenderablePost);
}

export async function getSortedRenderablePosts() {
  return getSortedPosts(await getRenderablePosts());
}
