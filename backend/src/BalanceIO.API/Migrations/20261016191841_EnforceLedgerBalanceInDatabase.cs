using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BalanceIO.API.Migrations
{
    /// <summary>
    /// The double-entry invariant, enforced by PostgreSQL itself.
    ///
    /// SaveChangesAsync already refuses an unbalanced Posted entry, but
    /// anything that reaches the database another way (raw SQL, a bulk
    /// operation, a future code path that skips the context) would not be
    /// stopped there. The constraint triggers are deferred to commit, so an
    /// entry and its lines can be written in any order inside one transaction;
    /// the check sees the final state. Comparison is exact, as in the
    /// application.
    /// </summary>
    public partial class EnforceLedgerBalanceInDatabase : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            if (ActiveProvider != "Npgsql.EntityFrameworkCore.PostgreSQL") return;

            migrationBuilder.Sql("""
                CREATE OR REPLACE FUNCTION ledger_check_entry_balance() RETURNS trigger AS $fn$
                DECLARE
                  entry_id uuid;
                  entry_status integer;
                  line_count integer;
                  total_debit numeric;
                  total_credit numeric;
                BEGIN
                  IF TG_TABLE_NAME = 'JournalEntries' THEN
                    entry_id := NEW."Id";
                  ELSIF TG_OP = 'DELETE' THEN
                    entry_id := OLD."JournalEntryId";
                  ELSE
                    entry_id := NEW."JournalEntryId";
                  END IF;

                  SELECT "Status" INTO entry_status FROM "JournalEntries" WHERE "Id" = entry_id;
                  IF NOT FOUND OR entry_status <> 1 THEN
                    RETURN NULL;
                  END IF;

                  SELECT count(*), COALESCE(sum("Debit"), 0), COALESCE(sum("Credit"), 0)
                    INTO line_count, total_debit, total_credit
                    FROM "JournalLines" WHERE "JournalEntryId" = entry_id;

                  IF line_count = 0 THEN
                    RAISE EXCEPTION 'Posted journal entry % has no lines', entry_id USING ERRCODE = '23514';
                  END IF;
                  IF total_debit <> total_credit THEN
                    RAISE EXCEPTION 'Posted journal entry % is unbalanced: debit % <> credit %', entry_id, total_debit, total_credit
                      USING ERRCODE = '23514';
                  END IF;
                  RETURN NULL;
                END
                $fn$ LANGUAGE plpgsql;
                """);

            migrationBuilder.Sql("""
                CREATE CONSTRAINT TRIGGER trg_journal_entries_balance
                  AFTER INSERT OR UPDATE ON "JournalEntries"
                  DEFERRABLE INITIALLY DEFERRED
                  FOR EACH ROW EXECUTE FUNCTION ledger_check_entry_balance();
                """);

            migrationBuilder.Sql("""
                CREATE CONSTRAINT TRIGGER trg_journal_lines_balance
                  AFTER INSERT OR UPDATE OR DELETE ON "JournalLines"
                  DEFERRABLE INITIALLY DEFERRED
                  FOR EACH ROW EXECUTE FUNCTION ledger_check_entry_balance();
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            if (ActiveProvider != "Npgsql.EntityFrameworkCore.PostgreSQL") return;

            migrationBuilder.Sql("""DROP TRIGGER IF EXISTS trg_journal_lines_balance ON "JournalLines";""");
            migrationBuilder.Sql("""DROP TRIGGER IF EXISTS trg_journal_entries_balance ON "JournalEntries";""");
            migrationBuilder.Sql("DROP FUNCTION IF EXISTS ledger_check_entry_balance();");
        }
    }
}
