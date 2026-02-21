"use client";

import { Header } from "@/components/layout/header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDOCharges,
  useDestCharges,
  useTransportCharges,
} from "@/hooks/use-pricing-tables";
import { formatCurrency } from "@/lib/utils";

export default function PricingPage() {
  const { data: doCharges, isLoading: doLoading } = useDOCharges();
  const { data: destCharges, isLoading: destLoading } = useDestCharges();
  const { data: transpCharges, isLoading: transpLoading } =
    useTransportCharges();

  return (
    <div>
      <Header
        title="Pricing Tables"
        description="Lookup tables used in cost calculations"
      />
      <div className="p-6">
        <Tabs defaultValue="do" className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto scrollbar-hide py-1 h-auto">
            <TabsTrigger value="do" className="shrink-0 tracking-tight">DO Charges</TabsTrigger>
            <TabsTrigger value="dest">Destination Charges</TabsTrigger>
            <TabsTrigger value="transport">Transportation</TabsTrigger>
          </TabsList>

          <TabsContent value="do" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  DO Charges by Carrier
                </CardTitle>
              </CardHeader>
              <CardContent>
                {doLoading ? (
                  <Skeleton className="h-48" />
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table className="min-w-[600px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Carrier</TableHead>
                          <TableHead className="text-right">
                            Document Fee
                          </TableHead>
                          <TableHead className="text-right">20FT</TableHead>
                          <TableHead className="text-right">40FT</TableHead>
                          <TableHead className="text-right">40HQ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {doCharges?.map((row) => (
                          <TableRow key={row.carrier}>
                            <TableCell className="font-medium">
                              {row.carrier}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(row.document)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(row["20FT"])}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(row["40FT"])}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(row["40HQ"])}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dest" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  UAE Destination Charges
                </CardTitle>
              </CardHeader>
              <CardContent>
                {destLoading ? (
                  <Skeleton className="h-48" />
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table className="min-w-[500px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Charge Type</TableHead>
                          <TableHead>Basis</TableHead>
                          <TableHead className="text-right">20FT</TableHead>
                          <TableHead className="text-right">40FT</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {destCharges?.map((row) => (
                          <TableRow key={row["Charge Type"]}>
                            <TableCell className="font-medium">
                              {row["Charge Type"]}
                            </TableCell>
                            <TableCell className="text-sm">
                              {row.Basis}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(row["20FT"])}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(row["40FT"])}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transport" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Transportation Charges by Location
                </CardTitle>
              </CardHeader>
              <CardContent>
                {transpLoading ? (
                  <Skeleton className="h-48" />
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table className="min-w-[400px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Place</TableHead>
                          <TableHead className="text-right">
                            Price (AED)
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transpCharges?.map((row) => (
                          <TableRow key={row.Place}>
                            <TableCell className="font-medium">
                              {row.Place}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(row.Price)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
