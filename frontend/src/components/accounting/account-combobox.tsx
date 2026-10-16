"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { apiClient } from "@/lib/api-client"

interface Account {
    id: string; // Guid or String? API returns ID/Code/Name
    code: string;
    name: string;
}

export function AccountCombobox({ value, onChange }: { value: string, onChange: (value: string) => void }) {
    const [open, setOpen] = React.useState(false)
    const [accounts, setAccounts] = React.useState<Account[]>([])
    const [isLoading, setIsLoading] = React.useState(false)

    React.useEffect(() => {
        // Fetch accounts when component mounts (or when open?)
        // Better to fetch once.
        async function loadAccounts() {
            setIsLoading(true)
            try {
                const data = await apiClient.getAccounts();
                // Map to our interface if needed
                const mapped = data.map((a: any) => ({
                    id: a.id,
                    code: a.code,
                    name: a.name
                })).sort((a, b) => a.code.localeCompare(b.code));
                setAccounts(mapped);
            } catch (err) {
                console.error("Failed to load accounts", err)
            } finally {
                setIsLoading(false)
            }
        }
        loadAccounts();
    }, [])

    const selectedAccount = accounts.find((account) => account.code === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal text-left"
                >
                    {value
                        ? selectedAccount ? `${selectedAccount.code} - ${selectedAccount.name}` : value
                        : "Select account..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[450px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search account..." />
                    <CommandList>
                        {isLoading && <div className="p-4 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading accounts...</div>}
                        <CommandEmpty>No account found.</CommandEmpty>
                        <CommandGroup>
                            <div className="grid grid-cols-[80px_1fr] px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">
                                <span>Code</span>
                                <span>Name</span>
                            </div>
                            {accounts.map((account) => (
                                <CommandItem
                                    key={account.code} // Use Code as key and value
                                    value={`${account.code} ${account.name}`} // Searchable string
                                    onSelect={() => {
                                        onChange(account.code) // We store Code or ID? Backend expects String (presumably Code or ID)
                                        // JournalLine has AccountId.
                                        // If Backend expects Code strings for AccountId (unlikely for Guid field), this logic is crucial.
                                        setOpen(false)
                                    }}
                                    className="cursor-pointer aria-selected:bg-primary/5"
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4 opacity-0 absolute left-2",
                                            value === account.code ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <div className="grid grid-cols-[80px_1fr] w-full items-center gap-2 pl-6">
                                        <span className={cn("font-mono font-medium", value === account.code && "text-primary")}>
                                            {account.code}
                                        </span>
                                        <span className="truncate text-muted-foreground group-aria-selected:text-foreground">
                                            {account.name}
                                        </span>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
