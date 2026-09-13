#!/usr/bin/env python3
"""Resolve a vendor-agnostic log field name to a specific SIEM's schema.

This is the plain-function precursor to an MCP tool: an agent (or an MCP
server wrapping this module) needs a `get_log_schema(field, vendor)` call
that answers "what does the generic concept 'target username' actually
map to in *this* SIEM's schema" — so detection logic written against
generic field names can be translated to real query language. SCHEMA is
keyed by vendor because the actual lab target here is Wazuh/Elastic
(no Defender license on a personal project) while the private-work-derived reference mapping was removed from this public
snapshot during curation.

Example:
    uv run schema-translator/schema_translator.py TargetUserName
    uv run schema-translator/schema_translator.py TargetUserName --vendor wazuh
    uv run schema-translator/schema_translator.py --list
"""
import argparse
import json

# generic_field -> {vendor -> {table/index, column, notes}}
# Seed only — extend with real schema knowledge per vendor.
SCHEMA = {
    "TargetUserName": {
        "defender": {
            "table": "IdentityLogonEvents",
            "column": "AccountUpn",
            "notes": "Identity-provider logons (AAD/AD). Use DeviceLogonEvents.AccountName for local/device logons instead.",
        },
    },
    "SourceIP": {
        "defender": {
            "table": "IdentityLogonEvents",
            "column": "IPAddress",
            "notes": "Also present as DeviceNetworkEvents.RemoteIP for network-layer connections.",
        },
    },
    "DeviceName": {
        "defender": {
            "table": "DeviceInfo",
            "column": "DeviceName",
            "notes": "Join key across most Device* tables via DeviceId.",
        },
    },
    "MachineAccountPasswordReset": {
        "defender": None,  # private-work-derived mapping removed during curation
        "wazuh": None,
    },
}


def get_log_schema(field: str, vendor: str = "defender") -> dict | None:
    return SCHEMA.get(field, {}).get(vendor)


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("field", nargs="?", help="Generic field name to resolve")
    parser.add_argument("--vendor", default="defender", help="Target SIEM vendor (default: defender)")
    parser.add_argument("--list", action="store_true", help="List all known field mappings, all vendors")
    args = parser.parse_args()

    if args.list or not args.field:
        print(json.dumps(SCHEMA, indent=2))
        return

    result = get_log_schema(args.field, args.vendor)
    if result is None:
        print(json.dumps(
            {"error": f"no '{args.vendor}' mapping for '{args.field}'", "known_fields": list(SCHEMA)},
            indent=2,
        ))
    else:
        print(json.dumps({args.field: {args.vendor: result}}, indent=2))


if __name__ == "__main__":
    main()
