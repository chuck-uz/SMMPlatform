"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LinkIcon,
  ChatBubbleLeftRightIcon,
  InboxIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
  PhotoIcon,
  UsersIcon,
  UserCircleIcon,
  BeakerIcon,
} from "@heroicons/react/24/outline";

const MODULE_NAV_ITEMS = [
  { href: "/panel/connections", label: "Подключения", icon: LinkIcon },
  { href: "/panel/inbox", label: "Инбокс", icon: InboxIcon },
  { href: "/panel/leads", label: "Заявки", icon: ClipboardDocumentListIcon },
  { href: "/panel/analytics", label: "Аналитика", icon: ChartBarIcon },
  { href: "/panel/content", label: "Контент", icon: PhotoIcon },
];

const ADMIN_NAV_ITEMS = [
  { href: "/panel/scenarios", label: "Агент", icon: ChatBubbleLeftRightIcon },
  { href: "/panel/models", label: "Модели", icon: BeakerIcon },
  { href: "/panel/users", label: "Пользователи", icon: UsersIcon },
];
const PROFILE_NAV_ITEM = { href: "/panel/profile", label: "Профиль", icon: UserCircleIcon };

export function PanelNav({
  direction = "vertical",
  isAdmin = false,
  pendingCommentCount = 0,
}: {
  direction?: "vertical" | "horizontal";
  isAdmin?: boolean;
  pendingCommentCount?: number;
}) {
  const pathname = usePathname();

  const mainItems = MODULE_NAV_ITEMS;
  const secondaryItems = [...(isAdmin ? ADMIN_NAV_ITEMS : []), PROFILE_NAV_ITEM];
  const badgeFor = (href: string) =>
    href === "/panel/inbox" && pendingCommentCount > 0 ? pendingCommentCount : null;

  if (direction === "horizontal") {
    return (
      <div className="flex gap-1">
        {[...mainItems, ...secondaryItems].map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          const badge = badgeFor(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-sm px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                isActive
                  ? "bg-accent/10 text-accent"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {item.label}
              {badge ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-semibold text-accent-foreground">
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    );
  }

  const railButtonClass = (isActive: boolean) =>
    `flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[11px] transition-colors duration-200 ${
      isActive ? "bg-accent/10 text-accent" : "text-subtle hover:bg-muted hover:text-foreground"
    }`;

  return (
    <div className="flex flex-col items-center gap-1.5">
      {mainItems.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        const badge = badgeFor(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            title={badge ? `${item.label} (${badge})` : item.label}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
            className={`relative ${railButtonClass(isActive)}`}
          >
            <Icon className="h-[19px] w-[19px]" aria-hidden="true" />
            {badge ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">
                {badge}
              </span>
            ) : null}
          </Link>
        );
      })}
      <div className="my-1.5 h-px w-8 bg-border" />
      {secondaryItems.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
            className={railButtonClass(isActive)}
          >
            <Icon className="h-[19px] w-[19px]" aria-hidden="true" />
          </Link>
        );
      })}
    </div>
  );
}
