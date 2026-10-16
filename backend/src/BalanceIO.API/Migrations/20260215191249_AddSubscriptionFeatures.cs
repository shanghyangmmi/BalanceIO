using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BalanceIO.API.Migrations
{
    /// <inheritdoc />
    public partial class AddSubscriptionFeatures : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            if (migrationBuilder.ActiveProvider == "Npgsql.EntityFrameworkCore.PostgreSQL")
            {
                 // Add Columns to Plans
                 migrationBuilder.Sql(
                    @"DO $$ 
                      BEGIN 
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Plans' AND column_name='MaxJournalEntries') THEN
                            ALTER TABLE ""Plans"" ADD ""MaxJournalEntries"" integer NOT NULL DEFAULT 0;
                        END IF;
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Plans' AND column_name='MaxStorageMB') THEN
                            ALTER TABLE ""Plans"" ADD ""MaxStorageMB"" bigint NOT NULL DEFAULT 0;
                        END IF;
                      END $$;");

                 // Add Columns to Accounts
                 migrationBuilder.Sql(
                    @"DO $$ 
                      BEGIN 
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Accounts' AND column_name='AccountGroup') THEN
                            ALTER TABLE ""Accounts"" ADD ""AccountGroup"" character varying(30) NOT NULL DEFAULT '';
                        END IF;
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Accounts' AND column_name='Description') THEN
                            ALTER TABLE ""Accounts"" ADD ""Description"" character varying(500);
                        END IF;
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Accounts' AND column_name='IsHeader') THEN
                            ALTER TABLE ""Accounts"" ADD ""IsHeader"" boolean NOT NULL DEFAULT FALSE;
                        END IF;
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Accounts' AND column_name='IsSystemDefault') THEN
                            ALTER TABLE ""Accounts"" ADD ""IsSystemDefault"" boolean NOT NULL DEFAULT FALSE;
                        END IF;
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Accounts' AND column_name='Level') THEN
                            ALTER TABLE ""Accounts"" ADD ""Level"" integer NOT NULL DEFAULT 0;
                        END IF;
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Accounts' AND column_name='NormalBalance') THEN
                            ALTER TABLE ""Accounts"" ADD ""NormalBalance"" character varying(10) NOT NULL DEFAULT '';
                        END IF;
                      END $$;");

                 // Create SystemSettings
                 migrationBuilder.Sql(
                    @"CREATE TABLE IF NOT EXISTS ""SystemSettings"" (
                        ""Key"" character varying(100) NOT NULL CONSTRAINT ""PK_SystemSettings"" PRIMARY KEY,
                        ""Value"" character varying(2000) NOT NULL,
                        ""Description"" character varying(500),
                        ""DataType"" character varying(50) NOT NULL
                    );");
            }
            else
            {
                migrationBuilder.AddColumn<int>(
                    name: "MaxJournalEntries",
                    table: "Plans",
                    nullable: false,
                    defaultValue: 0);

                migrationBuilder.AddColumn<long>(
                    name: "MaxStorageMB",
                    table: "Plans",
                    nullable: false,
                    defaultValue: 0L);

                migrationBuilder.AddColumn<string>(
                    name: "AccountGroup",
                    table: "Accounts",
                    maxLength: 30,
                    nullable: false,
                    defaultValue: "");

                migrationBuilder.AddColumn<string>(
                    name: "Description",
                    table: "Accounts",
                    maxLength: 500,
                    nullable: true);

                migrationBuilder.AddColumn<bool>(
                    name: "IsHeader",
                    table: "Accounts",
                    nullable: false,
                    defaultValue: false);

                migrationBuilder.AddColumn<bool>(
                    name: "IsSystemDefault",
                    table: "Accounts",
                    nullable: false,
                    defaultValue: false);

                migrationBuilder.AddColumn<int>(
                    name: "Level",
                    table: "Accounts",
                    nullable: false,
                    defaultValue: 0);

                migrationBuilder.AddColumn<string>(
                    name: "NormalBalance",
                    table: "Accounts",
                    maxLength: 10,
                    nullable: false,
                    defaultValue: "");

                migrationBuilder.CreateTable(
                    name: "SystemSettings",
                    columns: table => new
                    {
                        Key = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                        Value = table.Column<string>(type: "TEXT", maxLength: 2000, nullable: false),
                        Description = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                        DataType = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false)
                    },
                    constraints: table =>
                    {
                        table.PrimaryKey("PK_SystemSettings", x => x.Key);
                    });
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SystemSettings");

            migrationBuilder.DropColumn(
                name: "MaxJournalEntries",
                table: "Plans");

            migrationBuilder.DropColumn(
                name: "MaxStorageMB",
                table: "Plans");

            migrationBuilder.DropColumn(
                name: "AccountGroup",
                table: "Accounts");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "Accounts");

            migrationBuilder.DropColumn(
                name: "IsHeader",
                table: "Accounts");

            migrationBuilder.DropColumn(
                name: "IsSystemDefault",
                table: "Accounts");

            migrationBuilder.DropColumn(
                name: "Level",
                table: "Accounts");

            migrationBuilder.DropColumn(
                name: "NormalBalance",
                table: "Accounts");
        }
    }
}
