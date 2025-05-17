import { DataTypes, Model } from "@sequelize/core";
import User from './User.js';
import { sequelize } from '../sequelize.js';

class SocialLogin extends Model {}

SocialLogin.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    provider: {
        type: DataTypes.ENUM(['google', 'facebook', 'twitter']),
        allowNull: false,
    },
    provider_user_id: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      onUpdate: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'SocialLogin',
    tableName: 'social_logins',
    timestamps: false,
  }
);

// Associations
User.hasMany(SocialLogin, { foreignKey: 'user_id' });
SocialLogin.belongsTo(User, { foreignKey: 'user_id' });


export default SocialLogin;
