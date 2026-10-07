import BotIcon from '@cherrystudio/app-icons/icons/bot';
import Code2Icon from '@cherrystudio/app-icons/icons/code-2';
import DatabaseIcon from '@cherrystudio/app-icons/icons/database';
import GlobeIcon from '@cherrystudio/app-icons/icons/globe';
import MessageCircleIcon from '@cherrystudio/app-icons/icons/message-circle';
import { Chip, ContentState, Section } from '@cherrystudio/ui/components';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { useBackendModule } from '@/frontend/data';
import { webAccessQueryOptions } from '@/frontend/data/webAccess';
import type { WebAccessCapability } from '@/shared/contracts/webAccess';

import { SettingsScrollPage } from '../components/SettingsScrollPage';

const CAPABILITY_ICONS: Record<WebAccessCapability['id'], typeof GlobeIcon> = {
  agents: BotIcon,
  chat: MessageCircleIcon,
  files: DatabaseIcon,
  terminal: Code2Icon,
};

function CapabilityRow({ capability }: { capability: WebAccessCapability }) {
  const { t } = useTranslation();
  const Icon = CAPABILITY_ICONS[capability.id];

  return (
    <Section.Item
      label={t(`webAccess.capabilities.${capability.id}.title`)}
      leading={<Icon className="size-4 text-foreground" />}
      showChevron={false}
      testID={`web-access-${capability.id}`}
      trailing={
        <Chip.Tag className="px-2 py-0.5">
          <Chip.Label className="text-xs">{t(`webAccess.status.${capability.status}`)}</Chip.Label>
        </Chip.Tag>
      }
    />
  );
}

export default function WebAccessScreen() {
  const { t } = useTranslation();
  const webAccess = useBackendModule('webAccess');
  const { data, isLoading } = useQuery(webAccessQueryOptions(webAccess));

  const status = data;
  const pairedName = status?.environment.deviceName ?? t('webAccess.deviceName.fallback');

  return (
    <SettingsScrollPage contentClassName="gap-6" headerProps={{ title: t('webAccess.title') }}>
      {isLoading || !status ? (
        <ContentState.Loading title={t('webAccess.loading')} />
      ) : (
        <>
          <View className="gap-1 px-1">
            <Text className="text-sm text-muted-foreground">
              {t('webAccess.deviceName', { name: pairedName })}
            </Text>
          </View>
          <Section>
            {status.capabilities.map((capability) => (
              <CapabilityRow capability={capability} key={capability.id} />
            ))}
          </Section>
          <Section>
            <Section.Item
              description={t('webAccess.open.description')}
              label={t('webAccess.open.title')}
              leading={<GlobeIcon className="size-4 text-foreground" />}
              showChevron={false}
            />
          </Section>
        </>
      )}
    </SettingsScrollPage>
  );
}
