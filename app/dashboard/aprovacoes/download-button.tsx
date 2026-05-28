'use client'

import { Button } from '@/components/ui/button'

interface DownloadButtonProps {
  conteudoId: string
}

export function DownloadButton({ conteudoId }: DownloadButtonProps) {
  return (
    <a href={`/api/conteudos/${conteudoId}/download`} download>
      <Button
        variant="outline"
        size="sm"
        className="border-[#E2E8F0] text-[#0F172A] hover:bg-[#F1F5F9]"
      >
        Baixar post
      </Button>
    </a>
  )
}
