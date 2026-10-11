// The browser bundle of jsmediatags has no bundled types; declare what we use.
declare module "jsmediatags/dist/jsmediatags.min.js" {
  export function read(
    file: File,
    callbacks: {
      onSuccess: (result: { tags: Record<string, unknown> }) => void;
      onError: (error: unknown) => void;
    },
  ): void;
}
