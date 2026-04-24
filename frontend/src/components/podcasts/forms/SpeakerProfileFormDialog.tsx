'use client'

import { useCallback, useEffect } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import type { FieldErrorsImpl } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'

import { SpeakerProfile } from '@/lib/types/podcasts'
import { SpeakerProfileInput } from '@/lib/api/podcasts'
import {
  useCreateSpeakerProfile,
  useUpdateSpeakerProfile,
} from '@/lib/hooks/use-podcasts'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { ModelSelector } from '@/components/common/ModelSelector'

import type { TFunction } from 'i18next'
import { useTranslation } from '@/lib/hooks/use-translation'

const speakerConfigSchema = (t: TFunction) => z.object({
  name: z.string().min(1, t('common.nameRequired') || 'Name is required'),
  voice_id: z.string().min(1, t('podcasts.voiceIdRequired') || 'Voice ID is required'),
  backstory: z.string().min(1, t('podcasts.backstoryRequired') || 'Backstory is required'),
  personality: z.string().min(1, t('podcasts.personalityRequired') || 'Personality is required'),
  voice_model: z.string().nullable().optional(),
})

const speakerProfileSchema = (t: TFunction) => z.object({
  name: z.string().min(1, t('common.nameRequired') || 'Name is required'),
  description: z.string().optional(),
  tts_provider_type: z.enum(['edge', 'tencent', 'minimax', 'model']).optional().nullable(),
  tts_voice: z.string().optional().nullable(),
  voice_model: z.string().optional().nullable(),
  speakers: z
    .array(speakerConfigSchema(t))
    .min(1, t('podcasts.speakerCountMin') || 'At least one speaker is required')
    .max(4, t('podcasts.speakerCountMax') || 'You can configure up to 4 speakers'),
})

export type SpeakerProfileFormValues = z.infer<ReturnType<typeof speakerProfileSchema>>

interface SpeakerProfileFormDialogProps {
  mode: 'create' | 'edit'
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData?: SpeakerProfile
}

const EMPTY_SPEAKER = {
  name: '',
  voice_id: '',
  backstory: '',
  personality: '',
  voice_model: null as string | null,
}

export type TTSProviderType = 'edge' | 'tencent' | 'minimax' | 'model'

export function SpeakerProfileFormDialog({
  mode,
  open,
  onOpenChange,
  initialData,
}: SpeakerProfileFormDialogProps) {
  const { t } = useTranslation()
  const createProfile = useCreateSpeakerProfile()
  const updateProfile = useUpdateSpeakerProfile()

  const getDefaults = useCallback((): SpeakerProfileFormValues => {
    if (initialData) {
      return {
        name: initialData.name,
        description: initialData.description ?? '',
        tts_provider_type: (initialData.tts_provider_type as TTSProviderType) ?? 'model',
        tts_voice: initialData.tts_voice ?? null,
        voice_model: initialData.voice_model ?? '',
        speakers: initialData.speakers?.map((speaker) => ({
          ...speaker,
          voice_model: speaker.voice_model ?? null,
        })) ?? [{ ...EMPTY_SPEAKER }],
      }
    }

    return {
      name: '',
      description: '',
      tts_provider_type: 'model' as TTSProviderType,
      tts_voice: null,
      voice_model: '',
      speakers: [{ ...EMPTY_SPEAKER }],
    }
  }, [initialData])

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SpeakerProfileFormValues>({
    resolver: zodResolver(speakerProfileSchema(t)),
    defaultValues: getDefaults(),
  })

  const {
    fields,
    append,
    remove,
  } = useFieldArray({
    control,
    name: 'speakers',
  })

  const speakersArrayError = (
    errors.speakers as FieldErrorsImpl<{ root?: { message?: string } }> | undefined
  )?.root?.message

  useEffect(() => {
    if (!open) {
      return
    }
    reset(getDefaults())
  }, [open, reset, getDefaults])

  const onSubmit = async (values: SpeakerProfileFormValues) => {
    // Handle TTS provider type specific fields
    const { tts_provider_type, tts_voice, voice_model } = values

    // Build payload with conditional fields based on provider type
    const payload: SpeakerProfileInput = {
      name: values.name,
      description: values.description ?? '',
      tts_provider_type: tts_provider_type || 'model',
      speakers: values.speakers.map((s) => ({
        ...s,
        voice_model: s.voice_model || null,
      })),
    }

    // Add provider-specific fields
    if (tts_provider_type === 'edge' || tts_provider_type === 'tencent') {
      payload.tts_voice = tts_voice || (tts_provider_type === 'edge' ? 'zh-CN-XiaoxiaoNeural' : '1')
      payload.voice_model = null
    } else if (tts_provider_type === 'minimax') {
      payload.tts_voice = tts_voice || 'audiobook_male_1'
      payload.voice_model = null
    } else {
      // model mode
      payload.voice_model = voice_model || null
      payload.tts_voice = null
    }

    if (mode === 'create') {
      await createProfile.mutateAsync(payload)
    } else if (initialData) {
      await updateProfile.mutateAsync({
        profileId: initialData.id,
        payload,
      })
    }

    onOpenChange(false)
  }

  const isSubmitting = createProfile.isPending || updateProfile.isPending
  const disableSubmit = isSubmitting
  const isEdit = mode === 'edit'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('podcasts.editSpeakerProfile') : t('podcasts.createSpeakerProfile')}
          </DialogTitle>
          <DialogDescription>
            {t('podcasts.speakerProfileFormDesc')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-2">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">{t('podcasts.profileName')} *</Label>
              <Input id="name" placeholder={t('podcasts.profileNamePlaceholder')} {...register('name')} />
              {errors.name ? (
                <p className="text-xs text-red-600">{errors.name.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('common.description')}</Label>
              <Textarea
                id="description"
                rows={3}
                placeholder={t('podcasts.descriptionPlaceholder')}
                {...register('description')}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t('podcasts.voiceModel')}
              </h3>
              <Separator className="mt-2" />
            </div>

            {/* TTS Provider Type Toggle */}
            <Controller
              control={control}
              name="tts_provider_type"
              render={({ field }) => (
                <div className="space-y-2">
                  <Label>{t('podcasts.ttsProvider') || 'TTS Provider'}</Label>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant={field.value === 'edge' || !field.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => field.onChange('edge')}
                    >
                      Edge TTS
                    </Button>
                    <Button
                      type="button"
                      variant={field.value === 'tencent' ? "default" : "outline"}
                      size="sm"
                      onClick={() => field.onChange('tencent')}
                    >
                      腾讯云 TTS
                    </Button>
                    <Button
                      type="button"
                      variant={field.value === 'minimax' ? "default" : "outline"}
                      size="sm"
                      onClick={() => field.onChange('minimax')}
                    >
                      MiniMax TTS
                    </Button>
                    <Button
                      type="button"
                      variant={field.value === 'model' ? "default" : "outline"}
                      size="sm"
                      onClick={() => field.onChange('model')}
                    >
                      Model
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {field.value === 'edge' && '微软 Azure 免费 TTS，无需 API Key'}
                    {field.value === 'tencent' && '需要腾讯云 API 密钥'}
                    {field.value === 'minimax' && '需要 MiniMax API 密钥'}
                    {field.value === 'model' && '使用 Model 记录 (OpenAI, ElevenLabs 等)'}
                    {!field.value && '选择 TTS 提供者类型'}
                  </p>
                </div>
              )}
            />

            {/* Conditional TTS config based on provider type */}
            <Controller
              control={control}
              name="tts_provider_type"
              render={({ field }) => (
                <>
                  {(field.value === 'edge' || (!field.value && true)) && (
                    <Controller
                      control={control}
                      name="tts_voice"
                      render={({ field: voiceField }) => (
                        <div className="space-y-2">
                          <Label>{t('podcasts.edgeVoice') || 'Edge TTS Voice'}</Label>
                          <select
                            className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={voiceField.value || 'zh-CN-XiaoxiaoNeural'}
                            onChange={(e) => voiceField.onChange(e.target.value)}
                          >
                            <option value="zh-CN-XiaoxiaoNeural">中文女声 (XiaoxiaoNeural)</option>
                            <option value="zh-CN-YunxiNeural">中文男声 (YunxiNeural)</option>
                            <option value="zh-CN-XiaoyiNeural">中文女声 (XiaoyiNeural)</option>
                            <option value="zh-CN-YunyangNeural">中文新闻 (YunyangNeural)</option>
                            <option value="zh-CN-XiaochenNeural">中文客服 (XiaochenNeural)</option>
                            <option value="en-US-JennyNeural">英文女声 (JennyNeural)</option>
                            <option value="en-US-GuyNeural">英文男声 (GuyNeural)</option>
                            <option value="en-US-AriaNeural">英文 Aria</option>
                            <option value="ja-JP-NanamiNeural">日语女声 (NanamiNeural)</option>
                            <option value="ko-KR-SunHiNeural">韩语女声 (SunHiNeural)</option>
                          </select>
                        </div>
                      )}
                    />
                  )}

                  {field.value === 'tencent' && (
                    <Controller
                      control={control}
                      name="tts_voice"
                      render={({ field: voiceField }) => (
                        <div className="space-y-2">
                          <Label>{t('podcasts.tencentVoiceType') || '腾讯云 TTS 语音类型'}</Label>
                          <select
                            className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={voiceField.value || '1'}
                            onChange={(e) => voiceField.onChange(e.target.value)}
                          >
                            <option value="1">中文发音</option>
                            <option value="0">英文发音</option>
                            <option value="2">中英文混合</option>
                            <option value="5">韩文发音</option>
                            <option value="6">日文发音</option>
                            <option value="7">西班牙文</option>
                            <option value="8">法文</option>
                            <option value="9">德文</option>
                            <option value="11">葡萄牙文</option>
                            <option value="12">意大利文</option>
                            <option value="13">印尼文</option>
                            <option value="14">荷兰文</option>
                          </select>
                        </div>
                      )}
                    />
                  )}

                  {field.value === 'minimax' && (
                    <Controller
                      control={control}
                      name="tts_voice"
                      render={({ field: voiceField }) => (
                        <div className="space-y-2">
                          <Label>{t('podcasts.minimaxVoiceType') || 'MiniMax TTS 语音类型'}</Label>
                          <select
                            className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={voiceField.value || 'male-qn-qingse'}
                            onChange={(e) => voiceField.onChange(e.target.value)}
                          >
                            <option value="male-qn-qingse">青涩青年音色</option>
                            <option value="male-qn-jingying">精英青年音色</option>
                            <option value="male-qn-badao">霸道青年音色</option>
                            <option value="male-qn-daxuesheng">青年大学生音色</option>
                            <option value="female-shaonv">少女音色</option>
                            <option value="male-qn-666">男声测试</option>
                            <option value="female-tianmei">甜美女声</option>
                          </select>
                        </div>
                      )}
                    />
                  )}

                  {field.value === 'model' && (
                    <Controller
                      control={control}
                      name="voice_model"
                      render={({ field: modelField }) => (
                        <div>
                          <ModelSelector
                            label={`${t('podcasts.voiceModel')} *`}
                            modelType="text_to_speech"
                            value={modelField.value || ''}
                            onChange={modelField.onChange}
                            placeholder={t('podcasts.selectVoiceModel')}
                          />
                          {errors.voice_model && (
                            <p className="text-xs text-red-600 mt-1">
                              {errors.voice_model.message}
                            </p>
                          )}
                        </div>
                      )}
                    />
                  )}
                </>
              )}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('podcasts.speakers')}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t('podcasts.speakersDesc')}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ ...EMPTY_SPEAKER })}
                disabled={fields.length >= 4}
              >
                <Plus className="mr-2 h-4 w-4" /> {t('podcasts.addSpeaker')}
              </Button>
            </div>
            <Separator />

            {fields.map((field, index) => (
              <div key={field.id} className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">
                    {t('podcasts.speakerNumber').replace('{number}', (index + 1).toString())}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(index)}
                    disabled={fields.length <= 1}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> {t('common.remove')}
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`speaker-name-${index}`}>{t('common.name')} *</Label>
                    <Input
                      id={`speaker-name-${index}`}
                      {...register(`speakers.${index}.name` as const)}
                      placeholder={t('podcasts.hostPlaceholder').replace('{number}', (index + 1).toString())}
                      autoComplete="off"
                    />
                    {errors.speakers?.[index]?.name ? (
                      <p className="text-xs text-red-600">
                        {errors.speakers[index]?.name?.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`speaker-voice-${index}`}>{t('podcasts.voiceId')} *</Label>
                    <Input
                      id={`speaker-voice-${index}`}
                      {...register(`speakers.${index}.voice_id` as const)}
                      placeholder="voice_123"
                      autoComplete="off"
                    />
                    {errors.speakers?.[index]?.voice_id ? (
                      <p className="text-xs text-red-600">
                        {errors.speakers[index]?.voice_id?.message}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`speaker-backstory-${index}`}>{t('podcasts.backstory')} *</Label>
                  <Textarea
                    id={`speaker-backstory-${index}`}
                    rows={3}
                    placeholder={t('podcasts.backstoryPlaceholder')}
                    {...register(`speakers.${index}.backstory` as const)}
                    autoComplete="off"
                  />
                  {errors.speakers?.[index]?.backstory ? (
                    <p className="text-xs text-red-600">
                      {errors.speakers[index]?.backstory?.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`speaker-personality-${index}`}>{t('podcasts.personality')} *</Label>
                  <Textarea
                    id={`speaker-personality-${index}`}
                    rows={3}
                    placeholder={t('podcasts.personalityPlaceholder')}
                    {...register(`speakers.${index}.personality` as const)}
                    autoComplete="off"
                  />
                  {errors.speakers?.[index]?.personality ? (
                    <p className="text-xs text-red-600">
                      {errors.speakers[index]?.personality?.message}
                    </p>
                  ) : null}
                </div>
                <Controller
                  control={control}
                  name={`speakers.${index}.voice_model` as const}
                  render={({ field: vmField }) => (
                    <div>
                      <ModelSelector
                        label={t('podcasts.perSpeakerTtsOverride')}
                        modelType="text_to_speech"
                        value={vmField.value ?? ''}
                        onChange={(v) => vmField.onChange(v || null)}
                        placeholder={t('podcasts.useProfileDefault')}
                      />
                    </div>
                  )}
                />
              </div>
            ))}

            {speakersArrayError ? (
              <p className="text-xs text-red-600">{speakersArrayError}</p>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={disableSubmit}>
              {isSubmitting
                ? t('common.saving')
                : isEdit
                  ? t('common.saveChanges')
                  : t('podcasts.createProfile')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
