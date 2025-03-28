import { DependencyContainer } from "tsyringe";

import { IPostDBLoadMod } from "@spt/models/external/IPostDBLoadMod";
import { IPreSptLoadMod } from "@spt/models/external/IPreSptLoadMod";
import { ILogger } from "@spt/models/spt/utils/ILogger";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { IDatabaseTables } from "@spt/models/spt/server/IDatabaseTables";
import { BaseClasses } from "@spt/models/enums/BaseClasses";
import { LogTextColor } from "@spt/models/spt/logging/LogTextColor";
import { FileSystemSync } from "@spt/utils/FileSystemSync";

import { InstanceManager } from "./Refs/InstanceManager";

import { jsonc } from "jsonc";
import path from "path";

class ConfigurableMeds implements IPreSptLoadMod, IPostDBLoadMod
{
    // Get Package attributes/info
    private mod = require("../package.json")
    private modLabel = `[${this.mod.name}@${this.mod.version}]`

    // Get Instance
    private instance: InstanceManager = new InstanceManager();

    public preSptLoad(container: DependencyContainer): void
    {
        this.instance.preSptLoad(container, "Configurable Meds");
    }

    public postDBLoad(container: DependencyContainer): void 
    {
        // Parse jsonc files
        const fs = container.resolve<FileSystemSync>("FileSystemSync");
        const parseJsonc = (filename: string) =>
            jsonc.parse(
                fs.read(path.resolve(__dirname, `../config/${filename}.jsonc`))
            );

        // Get config file
        const config = parseJsonc("config");

        const color = LogTextColor;
        const baseClasses = BaseClasses;

        // Get database
        const databaseServer = container.resolve<DatabaseServer>("DatabaseServer");
        const tables: IDatabaseTables = databaseServer.getTables();
        const items = Object.values(tables.templates.items);
        const locales = tables.locales.global;

        // Get logger
        const logger = container.resolve<ILogger>("WinstonLogger");

        let stimsChanged = 0;
        let medkitsChanged = 0;
        let medicalChanged = 0;

        // Apply changes to stims/medkits/medical
        for (const item in items)
        {
            const itemProps = items[item]._props;
            const itemId = items[item]._id;
            const itemNameLocal = `${locales["en"][`${itemId} Name`]}`;
            
            // Check Blacklist
            if (config.enable_blacklist)
            {
                if (config.blacklisted_stims.includes(itemId) || config.blacklisted_medkits.includes(itemId) || config.blacklisted_medical.includes(itemId))
                    continue;
            }

            // Modify Stims/Injectors
            if (config.modify_stims)
            {
                if (items[item]._parent == baseClasses.STIMULATOR || items[item]._id == "544fb3f34bdc2d03748b456a")
                {
                    const stimUses = config.stim_uses;

                    itemProps.MaxHpResource = stimUses;

                    if (config.debug_log_changed_items)
                        logger.log(`${this.modLabel} (Stims/Injectors) Modified -> ${itemNameLocal} Nº uses set to -> ${stimUses}.`, color.MAGENTA);

                    stimsChanged++;
                }
            }

            // Modify Medical Items
            if (config.modify_medical)
            {

                // Medkit HP
                if (items[item]._parent == baseClasses.MEDKIT)
                {
                    const newHp = config.medkit_hp[itemNameLocal];

                    itemProps.MaxHpResource = newHp;

                    if (config.debug_log_changed_items)
                        logger.log(`${this.modLabel} (Medical [HP]) Modified -> ${itemNameLocal} HP set to -> ${newHp}.`, color.MAGENTA);
                    
                    medkitsChanged++;
                }

                // Medical Item Uses
                if (items[item]._parent == baseClasses.MEDICAL || items[item]._parent == baseClasses.DRUGS && items[item]._id != "544fb3f34bdc2d03748b456a")
                {
                    const medicalUses = config.medical_uses[itemNameLocal];

                    itemProps.MaxHpResource = medicalUses;

                    if (config.debug_log_changed_items)
                        logger.log(`${this.modLabel} (Medical [Uses]) Modified -> ${itemNameLocal} Nº uses set to -> ${medicalUses}.`, color.MAGENTA);
                
                    medicalChanged++;
                }
            }
        }
        logger.log(`${this.modLabel} Loaded successfully.`, color.GREEN)
        logger.log(`${this.modLabel} Modified a total of ${stimsChanged} Stims/Injectors && ${medkitsChanged + medicalChanged} Medical Items.`, color.CYAN);
    }
}

module.exports = { mod: new ConfigurableMeds() }