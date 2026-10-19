"use client";

import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription, // Added
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useCompanyData, updateCompanyData } from "@/hooks/use-company-data";
import { PageHeading } from "@/components/dashboard/page-heading";
import { useCan } from "@/components/auth/rbac-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

// ... (Schema and Form definitions remain same)
const profileSchema = z.object({
  name: z.string().min(1, "Enter the legal name"),
  industry: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  taxId: z.string().optional(),
  currency: z.string().optional(),
  fiscalYearStartMonth: z.number().optional(),
  lockDate: z.string().nullable().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function SettingsPage() {
    const can = useCan();
  const { company, isLoading, refetch } = useCompanyData();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      industry: "",
      address: "",
      city: "",
      country: "",
      phone: "",
      email: "",
      taxId: "",
      currency: "IDR",
      fiscalYearStartMonth: 1,
      lockDate: null,
    },
  });

  useEffect(() => {
    if (company && !isLoading) {
      form.reset({
        name: company.name || "",
        industry: company.industry || "",
        address: company.address || "",
        city: company.city || "",
        country: company.country || "",
        phone: company.phone || "",
        email: company.email || "",
        taxId: company.taxId || "",
        currency: company.currency || "IDR",
        fiscalYearStartMonth: company.fiscalYearStartMonth || 1,
        lockDate: company.lockDate || null,
      });
    }
  }, [company, isLoading, form]);

  async function onSubmit(data: ProfileFormValues) {
    setIsSaving(true);
    const result = await updateCompanyData(data);
    if (result.success) {
      toast.success("Company profile saved");
      refetch();
    } else {
      toast.error("The profile was not saved", { description: result.error });
    }
    setIsSaving(false);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeading
        eyebrow="Settings"
        title="Company profile"
        lede="The legal identity printed on invoices, faktur pajak and financial statements, and the controls that govern the ledger."
      />

          <div className="rounded-xl border border-foreground/10 bg-card/60 p-6 sm:p-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="flex flex-col-reverse md:flex-row items-start gap-8">
                  <div className="flex-1 space-y-4 w-full">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Legal name</FormLabel>
                          <FormControl>
                            <Input placeholder="PT Contoh Sejahtera" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input placeholder="finance@perusahaan.co.id" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone</FormLabel>
                            <FormControl>
                              <Input placeholder="+62..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Registered address" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City</FormLabel>
                            <FormControl>
                              <Input placeholder="Jakarta" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="country"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Country</FormLabel>
                            <FormControl>
                              <Input placeholder="Indonesia" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="currency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Reporting Currency</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select currency" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="IDR">IDR · Rupiah</SelectItem>
                                <SelectItem value="USD">USD · US dollar</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="taxId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>NPWP</FormLabel>
                            <FormControl>
                              <Input placeholder="0000 0000 0000 0000" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Ledger controls</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="lockDate"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>Lock Date</FormLabel>
                              <div className="flex gap-2">
                                <FormControl>
                                  <Input
                                    type="date"
                                    {...field}
                                    value={field.value || ""}
                                    onChange={(e) => field.onChange(e.target.value || null)}
                                  />
                                </FormControl>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => field.onChange(null)}
                                  title="Clear the lock date"
                                >
                                  Clear
                                </Button>
                              </div>
                              <FormDescription>
                                Entries dated on or before this day are locked against changes.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="fiscalYearStartMonth"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Fiscal year starts in</FormLabel>
                              <Select
                                onValueChange={(val) => field.onChange(parseInt(val))}
                                value={field.value?.toString()}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select a month" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                                    <SelectItem key={month} value={month.toString()}>
                                      {new Date(2000, month - 1).toLocaleString("en-GB", { month: "long" })}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Sidebar / Logo */}
                  <div className="w-full md:w-[250px] flex flex-col items-center gap-4">
                    <Avatar className="h-32 w-32 border border-foreground/10">
                      <AvatarFallback className="bg-muted/50">
                        <Building2 className="h-10 w-10 text-muted-foreground" strokeWidth={1.25} />
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-center text-[12px] leading-relaxed text-muted-foreground">
                      Logo upload is not available yet. Documents print with the company name.
                    </p>
                  </div>
                </div>

                <div className="flex justify-start">
                  {can(PERMISSIONS.SettingsManage) && <Button type="submit" disabled={isSaving}>
                    {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save changes
                  </Button>}
                </div>
              </form>
            </Form>
          </div>
    </div>
  );
}
