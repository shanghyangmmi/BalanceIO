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
import { Check, Upload, Building2, Loader2, Users, FileText } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useCompanyData, updateCompanyData } from "@/hooks/use-company-data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsersList } from "@/components/settings/users-list";
import { AuditLogViewer } from "@/components/settings/audit-log-viewer";

// ... (Schema and Form definitions remain same)
const profileSchema = z.object({
  name: z.string().min(1, "Company Name is required"),
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
      toast.success("Profile Updated");
      refetch();
    } else {
      toast.error("Update Failed", { description: result.error });
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
    <div className="space-y-6">
      <div>
        <h3 className="text-3xl font-bold tracking-tight text-gradient">Settings</h3>
        <p className="text-muted-foreground">Manage your company profile, team, and security.</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">
            <Building2 className="mr-2 h-4 w-4" /> Company Profile
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="mr-2 h-4 w-4" /> Team Members
          </TabsTrigger>
          <TabsTrigger value="audit">
            <FileText className="mr-2 h-4 w-4" /> Audit Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <div className="border rounded-xl p-6 bg-white dark:bg-zinc-900/50">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="flex flex-col-reverse md:flex-row items-start gap-8">
                  <div className="flex-1 space-y-4 w-full">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="PT. Your Company" {...field} />
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
                              <Input placeholder="company@example.com" {...field} />
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
                            <Textarea placeholder="Full Address" {...field} />
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
                                <SelectItem value="IDR">IDR - Indonesian Rupiah</SelectItem>
                                <SelectItem value="USD">USD - US Dollar</SelectItem>
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
                            <FormLabel>Tax ID / NPWP</FormLabel>
                            <FormControl>
                              <Input placeholder="00.000.000..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium mb-4">Financial Controls</h4>
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
                                  title="Unlock Period"
                                >
                                  Unlock
                                </Button>
                              </div>
                              <FormDescription>
                                Transactions on or before this date cannot be modified.
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
                              <FormLabel>Fiscal Year Start Month</FormLabel>
                              <Select
                                onValueChange={(val) => field.onChange(parseInt(val))}
                                value={field.value?.toString()}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select Month" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                                    <SelectItem key={month} value={month.toString()}>
                                      {new Date(0, month - 1).toLocaleString('default', { month: 'long' })}
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
                    <Avatar className="h-32 w-32 border-4 border-zinc-100 dark:border-zinc-800 shadow-xl">
                      <AvatarFallback className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20">
                        <Building2 className="h-12 w-12 text-[#0B3C3D] dark:text-emerald-400" />
                      </AvatarFallback>
                    </Avatar>
                    <Button variant="outline" size="sm" type="button">
                      <Upload className="h-4 w-4 mr-2" /> Change Logo
                    </Button>
                  </div>
                </div>

                <div className="flex justify-start">
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Check className="mr-2 h-4 w-4" />}
                    Save Changes
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </TabsContent>

        <TabsContent value="users">
          <UsersList />
        </TabsContent>

        <TabsContent value="audit">
          <AuditLogViewer />
        </TabsContent>
      </Tabs>
    </div>
  );
}
