export enum UploadType {
  Image = 'image',
  TrainingImages = 'training-images',
  Model = 'model',
  Default = 'default',
}

export type UploadTypeUnion = `${UploadType}`;

export enum ModelSort {
  HighestRated = 'Highest Rated',
  MostDownloaded = 'Most Downloaded',
  Newest = 'Newest',
}