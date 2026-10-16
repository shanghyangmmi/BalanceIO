using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BalanceIO.API.Migrations
{
    /// <inheritdoc />
    public partial class AddLockDateToCompany : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            if (migrationBuilder.ActiveProvider == "Npgsql.EntityFrameworkCore.PostgreSQL")
            {
                migrationBuilder.Sql(
                    @"DO $$ 
                      BEGIN 
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Companies' AND column_name='LockDate') THEN
                            ALTER TABLE ""Companies"" ADD ""LockDate"" date;
                        END IF;
                      END $$;");
            }
            else
            {
                migrationBuilder.AddColumn<DateOnly>(
                    name: "LockDate",
                    table: "Companies",
                    nullable: true);
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LockDate",
                table: "Companies");
        }
    }
}
