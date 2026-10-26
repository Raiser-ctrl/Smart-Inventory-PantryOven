
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  search: string;
  type: string;
};

export default function TransactionFilters({
  search,
  type,
}: Props) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState(search);

  // Sync the input when URL parameters change.
  useEffect(() => {
    setSearchValue(search);
  }, [search]);

  // Update URL parameters.
  function updateFilters(nextSearch: string, nextType: string) {
    const params = new URLSearchParams();

    if (nextSearch.trim()) {
      params.set("search", nextSearch.trim());
    }

    if (nextType !== "all") {
      params.set("type", nextType);
    }

    params.set("page", "1");

    router.replace(`/transactions?${params.toString()}`);
  }

  // Debounce search input.
  useEffect(() => {
    if (searchValue === search) return;

    const timeout = setTimeout(() => {
      updateFilters(searchValue, type);
    }, 400);

    return () => clearTimeout(timeout);
  }, [searchValue, search, type]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

        <Input
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="Search item name..."
          maxLength={100}
          className="pl-9"
        />
      </div>

      <Select
        value={type}
        onValueChange={(value) => updateFilters(searchValue, value)}
      >
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="Transaction Type" />
        </SelectTrigger>

        <SelectContent>
          <SelectItem value="all">All Transactions</SelectItem>
          <SelectItem value="stock_in">Stock In</SelectItem>
          <SelectItem value="stock_out">Stock Out</SelectItem>
          <SelectItem value="usage">Usage</SelectItem>
          <SelectItem value="waste">Waste</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
