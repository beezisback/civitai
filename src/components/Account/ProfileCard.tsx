import { Stack, Button, Alert, Card, Title } from '@mantine/core';
import { useSession } from 'next-auth/react';
import { z } from 'zod';
import { Form, InputProfileImageUpload, InputText, useForm } from '~/libs/form';
import { reloadSession } from '~/utils/next-auth-helpers';
import { showSuccessNotification } from '~/utils/notifications';
import { trpc } from '~/utils/trpc';

const schema = z.object({
  username: z.string(),
  image: z.string().nullable(),
});

export function ProfileCard() {
  const { data: session } = useSession();
  const utils = trpc.useContext();

  const { mutate, isLoading, error } = trpc.user.update.useMutation({
    async onSuccess(user) {
      showSuccessNotification({ message: 'Your profile has been saved' });
      // await utils.model.getAll.invalidate();
      await utils.review.getAll.invalidate();
      await reloadSession();
      if (user)
        form.reset({
          image: user.image ?? null,
          username: user.username ?? undefined,
        });
    },
  });

  const form = useForm({
    schema,
    mode: 'onChange',
    defaultValues: session?.user,
  });

  return (
    <Card withBorder>
      <Form form={form} onSubmit={(data) => mutate({ id: session?.user?.id, ...data })}>
        <Stack>
          <Title order={2}>Profile</Title>
          {error && (
            <Alert color="red" variant="light">
              {error.message}
            </Alert>
          )}
          <InputText name="username" label="Username" required />
          <InputProfileImageUpload name="image" label="Profile image" />
          <Button type="submit" loading={isLoading} disabled={!form.formState.isDirty}>
            Save
          </Button>
        </Stack>
      </Form>
    </Card>
  );
}
