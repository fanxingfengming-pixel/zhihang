"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f6f2] px-6">
      <section className="max-w-md rounded-3xl border border-black/10 bg-white p-8 text-center shadow-sm">
        <p className="mb-2 text-sm font-semibold text-[#33745b]">职航暂时迷路了</p>
        <h1 className="text-2xl font-bold text-[#17231f]">页面加载失败</h1>
        <p className="mt-3 text-sm leading-6 text-[#68746f]">你的求职档案仍保存在当前浏览器，可以放心重试。</p>
        <button className="mt-6 rounded-full bg-[#173c30] px-5 py-2.5 text-sm font-semibold text-white" onClick={reset}>
          重新加载
        </button>
      </section>
    </main>
  );
}
