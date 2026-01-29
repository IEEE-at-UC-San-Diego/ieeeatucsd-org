import React, { useMemo } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Progress,
  Card,
  CardBody,
  CardHeader,
} from "@heroui/react";
import type { OfficerTeam } from "../../../../shared/types/firestore";
import type { TeamMember } from "../../types/OfficerLeaderboardTypes";

interface OfficerDetailsTableProps {
  team: OfficerTeam;
  members: TeamMember[];
  teamAttendanceRate: number;
  maxAttendanceRate: number;
  rank: number;
}



export default function OfficerDetailsTable({
  team,
  members,
  teamAttendanceRate,
  maxAttendanceRate,
  rank,
}: OfficerDetailsTableProps) {
  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => b.eventsAttended - a.eventsAttended);
  }, [members]);

  const progressPercentage =
    maxAttendanceRate > 0 ? (teamAttendanceRate / maxAttendanceRate) * 100 : 0;

  const columns = [
    { key: "rank", label: "#", minWidth: 40 },
    { key: "name", label: "OFFICER", minWidth: 200 },
    { key: "position", label: "POSITION", minWidth: 150 },
    { key: "events", label: "EVENTS", minWidth: 100 },
    { key: "contribution", label: "CONTRIBUTION", minWidth: 140 },
  ];

  const renderCell = (member: TeamMember, columnKey: string) => {
    switch (columnKey) {
      case "rank":
        const memberRank =
          sortedMembers.findIndex((m) => m.userId === member.userId) + 1;
        return (
          <span className="text-sm font-medium text-gray-400 font-mono pl-2">
            {String(memberRank).padStart(2, '0')}
          </span>
        );

      case "name":
        const initials = member.name
          .split(" ")
          .map((n: string) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);

        return (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-500 text-xs font-semibold">
              {initials}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-900 leading-none">
                {member.name}
              </span>
              <span className="text-[10px] uppercase text-gray-400 mt-1">{member.role}</span>
            </div>
          </div>
        );

      case "position":
        return (
          <span className="text-sm text-gray-500 font-medium">
            {member.position}
          </span>
        );

      case "events":
        return (
          <div className="text-center">
            <span className="text-sm font-semibold text-gray-700">
              {member.eventsAttended}
            </span>
          </div>
        );

      case "contribution":
        const contribution =
          members.length > 0
            ? (member.eventsAttended / members.length) * 100
            : 0;

        return (
          <div className="flex items-center gap-3 w-full max-w-[140px]">
            <Progress
              value={contribution}
              size="sm"
              radius="full"
              classNames={{
                base: "max-w-md",
                track: "bg-gray-100 h-1.5",
                indicator: "bg-gray-800 h-1.5", // Minimalist dark grey progress
              }}
              aria-label="Contribution"
            />
            <span className="text-xs font-mono text-gray-400 w-[30px] text-right">
              {contribution.toFixed(0)}%
            </span>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className="w-full border border-gray-200 shadow-sm bg-white overflow-hidden rounded-xl">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-4 border-b border-gray-100 bg-gray-50/30">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-sm font-bold text-gray-600 shadow-sm">
            #{rank}
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">
              {team} Team
            </h3>
            <div className="text-xs text-gray-500 font-medium mt-0.5">
              {members.length} Officers
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Performance</span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-gray-900">{teamAttendanceRate.toFixed(1)}%</span>
            </div>
          </div>
          <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gray-900 rounded-full"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </CardHeader>

      <CardBody className="p-0">
        {members.length > 0 ? (
          <Table
            aria-label={`${team} team officers`}
            removeWrapper
            classNames={{
              th: "bg-white text-xs font-semibold text-gray-400 uppercase tracking-wider py-3 border-b border-gray-100 pl-6",
              td: "py-3 border-b border-gray-50 last:border-0 pl-6",
              tr: "hover:bg-gray-50/50 transition-colors",
            }}
          >
            <TableHeader columns={columns}>
              {(column) => (
                <TableColumn
                  key={column.key}
                  align={column.key === "name" || column.key === "position" ? "start" : "center"}
                  width={column.minWidth}
                >
                  {column.label}
                </TableColumn>
              )}
            </TableHeader>
            <TableBody items={sortedMembers}>
              {(item) => (
                <TableRow key={item.userId}>
                  {(columnKey) => (
                    <TableCell>
                      {renderCell(item, columnKey as string)}
                    </TableCell>
                  )}
                </TableRow>
              )}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-400 text-sm">
              No officers assigned yet.
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
