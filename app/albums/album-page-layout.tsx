import type { ReactNode } from "react";
import { SiteHeader } from "@/app/components/site-header";

type AlbumPageLayoutProps = {
  backLink: ReactNode;
  children: ReactNode;
};

export function AlbumPageLayout({ backLink, children }: AlbumPageLayoutProps) {
  return (
    <div className="min-h-screen bg-zinc-100">
      <SiteHeader />

      <main className="mx-auto max-w-[1680px] px-6 py-10">
        {backLink}
        <section className="mt-6">{children}</section>
      </main>
    </div>
  );
}

