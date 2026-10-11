// Import the browser bundle directly: the default entry pulls in react-native-fs.
import jsmediatags from "jsmediatags/dist/jsmediatags.min.js";

type TagPicture = { data: number[]; format: string };

export function readAlbumArt(file: File): Promise<string | null> {
  if (file.type.startsWith("video/")) return Promise.resolve(null);
  return new Promise((resolve) => {
    jsmediatags.read(file, {
      onSuccess: ({ tags }) => {
        const picture = tags.picture as TagPicture | undefined;
        if (!picture?.data?.length) {
          resolve(null);
          return;
        }
        resolve(URL.createObjectURL(new Blob([new Uint8Array(picture.data)], { type: picture.format })));
      },
      onError: () => resolve(null),
    });
  });
}