import {
  ModelFileFormat,
  ModelFileType,
  ModelType,
  Prisma,
  UserActivityType,
} from '@prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

import { env } from '~/env/server.mjs';
import { prisma } from '~/server/db/client';
import { getServerAuthSession } from '~/server/utils/get-server-auth-session';
import { filenamize } from '~/utils/string-helpers';
import { getGetUrl } from '~/utils/s3-utils';

const schema = z.object({
  modelVersionId: z.preprocess((val) => Number(val), z.number()),
  type: z.nativeEnum(ModelFileType).optional(),
  format: z.nativeEnum(ModelFileFormat).optional(),
});

export default async function downloadModel(req: NextApiRequest, res: NextApiResponse) {
  const results = schema.safeParse(req.query);
  if (!results.success)
    return res
      .status(400)
      .json({ error: `Invalid id: ${results.error.flatten().fieldErrors.modelVersionId}` });

  const { type, modelVersionId, format } = results.data;
  if (!modelVersionId) return res.status(400).json({ error: 'Missing modelVersionId' });

  const fileWhere: Prisma.ModelFileWhereInput = {};
  if (type) fileWhere.type = type;
  if (format) fileWhere.format = format;
  if (!type && !format) fileWhere.primary = true;

  const modelVersion = await prisma.modelVersion.findFirst({
    where: { id: modelVersionId },
    select: {
      id: true,
      model: { select: { id: true, name: true, type: true } },
      name: true,
      trainedWords: true,
      files: { where: fileWhere, select: { url: true, name: true, type: true } },
    },
  });
  if (!modelVersion) return res.status(404).json({ error: 'Model not found' });
  if (!modelVersion.files.length) return res.status(404).json({ error: 'Model file not found' });

  const session = await getServerAuthSession({ req, res });
  const userId = session?.user?.id;
  if (!env.UNAUTHENTICATED_DOWNLOAD && !userId) {
    if (req.headers['content-type'] === 'application/json')
      return res.status(401).json({ error: 'Unauthorized' });
    else return res.redirect(`/login?returnUrl=/models/${modelVersion.model.id}`);
  }

  // Track download
  try {
    await prisma.userActivity.create({
      data: {
        userId,
        activity: UserActivityType.ModelDownload,
        details: { modelId: modelVersion.model.id, modelVersionId: modelVersion.id },
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Invalid database operation', cause: error });
  }

  const [file] = modelVersion.files;
  const fileName = getDownloadFilename({ model: modelVersion.model, modelVersion, file });
  const { url } = await getGetUrl(file.url, { fileName });
  res.redirect(url);
}

export function getDownloadFilename({
  model,
  modelVersion,
  file,
}: {
  model: { name: string; type: ModelType };
  modelVersion: { name: string; trainedWords: string[] };
  file: { name: string; type: ModelFileType };
}) {
  let fileName = file.name;
  if (model.type === ModelType.TextualInversion) {
    const trainedWord = modelVersion.trainedWords[0];
    if (trainedWord) fileName = `${trainedWord}.pt`;
  } else if (file.type === ModelFileType.TrainingData) {
    fileName = `${filenamize(model.name)}_${filenamize(modelVersion.name)}_trainingData.zip`;
  } else if (file.type !== ModelFileType.VAE) {
    let fileSuffix = '';
    if (fileName.includes('-inpainting')) fileSuffix = '-inpainting';

    const ext = file.name.split('.').pop();
    fileName = `${filenamize(model.name)}_${filenamize(modelVersion.name)}${fileSuffix}.${ext}`;
  }
  return fileName;
}
