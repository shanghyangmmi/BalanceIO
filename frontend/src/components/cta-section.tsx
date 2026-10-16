import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import { siteConfig } from "@/config/site"

export function CtaSection() {
    return (
        <section className="bg-zinc-50 dark:bg-zinc-950 py-24 sm:py-32 border-t border-zinc-200 dark:border-white/5">
            <div className="container">
                <div className="relative isolate overflow-hidden rounded-[2.5rem] bg-zinc-900 dark:bg-zinc-900 px-6 py-24 text-center shadow-2xl sm:px-16 border border-zinc-800 dark:border-white/5 group transition-all">

                    {/* Background */}
                    <div className="absolute inset-0 -z-10 bg-[radial-gradient(40%_128%_at_50%_100%,#00000000_30%,#3b82f620_100%)]" />
                    <div className="absolute inset-0 -z-10 opacity-30 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

                    <div className="relative max-w-3xl mx-auto">
                        <div className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400 mb-6 border border-blue-500/20">
                            <span>🚀</span> Start your journey today
                        </div>

                        <h2 className="mx-auto text-4xl font-black tracking-tight text-white sm:text-6xl">
                            Ready to modernize <br /> your workflow?
                        </h2>
                        <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-zinc-400">
                            Join the new generation of founders who run their businesses on {siteConfig.name}.
                            Cancel anytime. No hidden fees.
                        </p>
                        <div className="mt-10 flex items-center justify-center gap-x-6">
                            <Link href="/dashboard">
                                <Button size="lg" className="h-14 px-8 text-lg rounded-full bg-white text-black hover:bg-zinc-200 transition-all font-bold">
                                    Get Started for Free
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
